import dns, { type LookupAddress } from "node:dns";
import http, { type IncomingMessage } from "node:http";
import https from "node:https";
import net from "node:net";
import type { Readable } from "node:stream";
import zlib from "node:zlib";

/** Raised when a target resolves to an address the server must not reach. */
export class BlockedTargetError extends Error {
  constructor(message = "Target address is not allowed (private networks are blocked).") {
    super(message);
    this.name = "BlockedTargetError";
  }
}

export class TargetTimeoutError extends Error {
  constructor() {
    super("Target request timed out.");
    this.name = "TargetTimeoutError";
  }
}

export class ResponseTooLargeError extends Error {
  constructor(limit: number) {
    super(`Target response exceeds the ${Math.round(limit / 1024 / 1024)} MB limit.`);
    this.name = "ResponseTooLargeError";
  }
}

const blockList = new net.BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, incl. cloud metadata 169.254.169.254
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // TEST-NET-1
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // TEST-NET-2
  ["203.0.113.0", 24], // TEST-NET-3
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
] as const) {
  blockList.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128], // unspecified
  ["::1", 128], // loopback
  ["64:ff9b::", 96], // NAT64
  ["100::", 64], // discard
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4 (embeds IPv4)
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
] as const) {
  blockList.addSubnet(network, prefix, "ipv6");
}

/** IPv4-mapped IPv6 (::ffff:a.b.c.d) is matched against the IPv4 rules by net.BlockList itself. */
export function isBlockedAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return blockList.check(address, "ipv4");
  if (family === 6) return blockList.check(address, "ipv6");
  return true;
}

function guardedLookup(allowPrivate: boolean): net.LookupFunction {
  return (hostname, options, callback) => {
    dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
      if (error) {
        callback(error, "", 0);
        return;
      }
      const list = addresses as unknown as LookupAddress[];
      if (list.length === 0) {
        callback(new Error(`No addresses found for ${hostname}`), "", 0);
        return;
      }
      if (!allowPrivate && list.some((entry) => isBlockedAddress(entry.address))) {
        callback(new BlockedTargetError(), "", 0);
        return;
      }
      if ((options as { all?: boolean }).all) {
        (callback as unknown as (err: null, addresses: LookupAddress[]) => void)(null, list);
        return;
      }
      callback(null, list[0]!.address, list[0]!.family);
    });
  };
}

/** Validate scheme and literal-IP hosts up front; DNS names are checked at connect time. */
export function assertAllowedUrl(rawUrl: string, allowPrivate: boolean): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BlockedTargetError("Invalid target URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BlockedTargetError("Only http and https targets are supported.");
  }
  if (url.username || url.password) {
    throw new BlockedTargetError("Credentials in the target URL are not supported; send an Authorization header instead.");
  }
  if (!allowPrivate) {
    const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost")) {
      throw new BlockedTargetError();
    }
    if (net.isIP(host) && isBlockedAddress(host)) {
      throw new BlockedTargetError();
    }
  }
  return url;
}

/** Request headers that describe the hop to us, not the request to the target. */
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "accept-encoding",
]);

export interface SafeFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs: number;
  maxResponseBytes: number;
  allowPrivateNetworks: boolean;
  maxRedirects?: number;
}

export interface SafeFetchResult {
  status: number;
  headers: Record<string, string>;
  body: string;
  url: string;
}

function sanitizeRequestHeaders(headers: Record<string, string> | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers ?? {})) {
    if (typeof value !== "string") continue;
    if (HOP_BY_HOP_HEADERS.has(name.toLowerCase())) continue;
    result[name] = value;
  }
  // We decode these encodings ourselves; ask for nothing else.
  result["accept-encoding"] = "gzip, deflate, br";
  return result;
}

function decodedStream(response: IncomingMessage): Readable {
  switch ((response.headers["content-encoding"] ?? "").toLowerCase()) {
    case "gzip":
    case "x-gzip":
      return response.pipe(zlib.createGunzip());
    case "deflate":
      return response.pipe(zlib.createInflate());
    case "br":
      return response.pipe(zlib.createBrotliDecompress());
    default:
      return response;
  }
}

async function readBody(response: IncomingMessage, maxBytes: number): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  const stream = decodedStream(response);
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
    total += buffer.length;
    if (total > maxBytes) {
      response.destroy();
      throw new ResponseTooLargeError(maxBytes);
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function responseHeaders(response: IncomingMessage): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(response.headers)) {
    if (value === undefined) continue;
    // The body we return is already decoded.
    if (name === "content-encoding" || name === "content-length" || name === "transfer-encoding") continue;
    result[name] = Array.isArray(value) ? value.join(", ") : value;
  }
  return result;
}

function sendOnce(
  url: URL,
  options: SafeFetchOptions,
  method: string,
  headers: Record<string, string>,
  body: string | undefined,
  signal: AbortSignal
): Promise<IncomingMessage> {
  const transport = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const request = transport.request(
      url,
      {
        method,
        headers: body !== undefined ? { ...headers, "content-length": String(Buffer.byteLength(body)) } : headers,
        lookup: guardedLookup(options.allowPrivateNetworks),
        signal,
      },
      resolve
    );
    request.on("error", reject);
    if (body !== undefined) request.write(body);
    request.end();
  });
}

/**
 * Outbound HTTP for user-supplied URLs. Every connection (including each
 * redirect hop) re-validates the resolved IP, which also defeats DNS rebinding.
 */
export async function safeFetch(rawUrl: string, options: SafeFetchOptions): Promise<SafeFetchResult> {
  const signal = AbortSignal.timeout(options.timeoutMs);
  try {
    return await followRedirects(rawUrl, options, signal);
  } catch (error) {
    if (signal.aborted) throw new TargetTimeoutError();
    throw error;
  }
}

async function followRedirects(rawUrl: string, options: SafeFetchOptions, signal: AbortSignal): Promise<SafeFetchResult> {
  const maxRedirects = options.maxRedirects ?? 5;

  let url = assertAllowedUrl(rawUrl, options.allowPrivateNetworks);
  let method = (options.method ?? "GET").toUpperCase();
  let headers = sanitizeRequestHeaders(options.headers);
  let body = method === "GET" || method === "HEAD" ? undefined : options.body;

  for (let hop = 0; ; hop++) {
    const response = await sendOnce(url, options, method, headers, body, signal);
    const status = response.statusCode ?? 0;
    const location = response.headers.location;

    if (status >= 300 && status < 400 && location && hop < maxRedirects) {
      response.resume();
      const next = assertAllowedUrl(new URL(location, url).toString(), options.allowPrivateNetworks);
      if (next.origin !== url.origin) {
        // Never forward credentials to a different origin.
        headers = Object.fromEntries(
          Object.entries(headers).filter(([name]) => !["authorization", "cookie"].includes(name.toLowerCase()))
        );
      }
      if (status === 303 || ((status === 301 || status === 302) && method === "POST")) {
        method = "GET";
        body = undefined;
      }
      url = next;
      continue;
    }

    const text = method === "HEAD" ? "" : await readBody(response, options.maxResponseBytes);
    return { status, headers: responseHeaders(response), body: text, url: url.toString() };
  }
}
