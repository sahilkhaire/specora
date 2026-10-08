import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

/** Hosted Specora web app; localhost origins are always allowed. */
export const DEFAULT_ALLOWED_ORIGINS = ["https://specora.varcore.dev"];

const MAX_REQUEST_BYTES = 10 * 1024 * 1024;
const DEFAULT_UPSTREAM_TIMEOUT_MS = 10_000;
const LOOPBACK_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

export interface ProxyServerOptions {
  port: number;
  /** Interface to bind. Defaults to loopback so other machines can't use the proxy. */
  host?: string;
  /**
   * Browser origins allowed to call the proxy, in addition to localhost.
   * `*` allows any website, which lets any page you visit reach your local network.
   */
  allowedOrigins?: string[];
}

class RequestTooLargeError extends Error {}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function isOriginAllowed(origin: string | undefined, allowed: string[]): boolean {
  // Non-browser clients (curl, scripts) send no Origin; CORS doesn't apply to them.
  if (!origin) return true;
  if (allowed.includes("*")) return true;
  if (LOOPBACK_ORIGIN.test(origin)) return true;
  return allowed.some((entry) => entry.replace(/\/$/, "").toLowerCase() === origin.toLowerCase());
}

function applyCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "600");
  // Chrome Private Network Access: lets the hosted app (public origin) call this loopback server.
  if (req.headers["access-control-request-private-network"] === "true") {
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_REQUEST_BYTES) {
      throw new RequestTooLargeError();
    }
    chunks.push(buffer);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) {
    return {};
  }

  const parsed: unknown = JSON.parse(raw);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
}

function getUpstreamTimeoutMs(): number {
  const raw = process.env.SPECORA_PROXY_TIMEOUT_MS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_UPSTREAM_TIMEOUT_MS;
}

function tryParseUrl(rawUrl: string): URL | null {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function stringHeaders(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}

async function handleProxy(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let payload: Record<string, unknown>;
  try {
    payload = await readJsonBody(req);
  } catch (error) {
    if (error instanceof RequestTooLargeError) {
      sendJson(res, 413, { ok: false, error: "Request body is too large." });
    } else {
      sendJson(res, 400, { ok: false, error: "Invalid JSON body." });
    }
    return;
  }

  const url = typeof payload.url === "string" ? payload.url : "";
  const method = typeof payload.method === "string" && payload.method.trim() ? payload.method.trim().toUpperCase() : "GET";
  const headers = stringHeaders(payload.headers);
  const body = typeof payload.body === "string" ? payload.body : undefined;

  if (!url) {
    sendJson(res, 400, { ok: false, error: "Field 'url' is required." });
    return;
  }

  if (!tryParseUrl(url)) {
    sendJson(res, 400, { ok: false, error: "Invalid target URL." });
    return;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: ["GET", "HEAD"].includes(method) ? undefined : body,
      signal: AbortSignal.timeout(getUpstreamTimeoutMs())
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    const message = error instanceof Error ? error.message : "";
    const isTimeout = name === "TimeoutError" || message.toLowerCase().includes("timeout");
    sendJson(res, isTimeout ? 504 : 502, {
      ok: false,
      error: isTimeout ? "Target request timed out." : "Target request failed."
    });
    return;
  }

  const responseText = await response.text();
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    // fetch() already decoded the body.
    if (key === "content-encoding" || key === "content-length") return;
    responseHeaders[key] = value;
  });

  sendJson(res, response.ok ? 200 : 502, {
    ok: response.ok,
    status: response.status,
    headers: responseHeaders,
    body: responseText,
    error: response.ok ? undefined : `Target returned HTTP ${response.status}`
  });
}

export function startProxyServer(options: ProxyServerOptions | number): Server {
  const { port, host = "127.0.0.1", allowedOrigins = DEFAULT_ALLOWED_ORIGINS } =
    typeof options === "number" ? { port: options } : options;

  const proxyServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (!isOriginAllowed(req.headers.origin, allowedOrigins)) {
      sendJson(res, 403, {
        ok: false,
        error: `Origin ${req.headers.origin} is not allowed. Restart with --allow-origin ${req.headers.origin}`
      });
      return;
    }

    applyCorsHeaders(req, res);

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method !== "POST" || req.url !== "/proxy") {
      sendJson(res, 404, { ok: false, error: "Use POST /proxy" });
      return;
    }

    try {
      await handleProxy(req, res);
    } catch {
      if (!res.headersSent) {
        sendJson(res, 500, { ok: false, error: "Proxy request failed." });
      }
    }
  });

  proxyServer.listen(port, host, () => {
    const address = proxyServer.address();
    const boundPort = address && typeof address !== "string" ? address.port : port;
    const displayHost = host.includes(":") ? `[${host}]` : host;
    console.log(`Specora proxy listening at http://${displayHost}:${boundPort}/proxy`);
    console.log(`Allowed browser origins: localhost, ${allowedOrigins.join(", ")}`);
  });

  return proxyServer;
}
