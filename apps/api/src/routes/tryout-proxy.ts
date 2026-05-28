import { Hono } from "hono";
import { isIP } from "node:net";

const DEFAULT_UPSTREAM_TIMEOUT_MS = 30_000;

interface ProxyBody {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string | null;
}

function getUpstreamTimeoutMs(): number {
  const raw = process.env.SPECORA_PROXY_TIMEOUT_MS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_UPSTREAM_TIMEOUT_MS;
}

function allowPrivateNetworks(): boolean {
  return process.env.PROXY_ALLOW_PRIVATE_NETWORKS === "true";
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".").map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    return true;
  }
  if (host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) {
    return true;
  }
  const ipVersion = isIP(host);
  if (ipVersion === 4) return isPrivateIpv4(host);
  if (ipVersion === 6) {
    return host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:");
  }
  return false;
}

function validateTargetUrl(rawUrl: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return null;
  }

  if (!allowPrivateNetworks() && isBlockedHostname(parsed.hostname)) {
    return null;
  }

  return parsed;
}

export const tryoutProxyRoutes = new Hono();

tryoutProxyRoutes.post("/proxy", async (c) => {
  if (process.env.PROXY_ENABLED === "false") {
    return c.json({ ok: false, error: "Try-out proxy is disabled on this server." }, 403);
  }

  let payload: ProxyBody;
  try {
    payload = await c.req.json<ProxyBody>();
  } catch {
    return c.json({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const url = typeof payload.url === "string" ? payload.url.trim() : "";
  const method =
    typeof payload.method === "string" && payload.method.trim()
      ? payload.method.trim().toUpperCase()
      : "GET";
  const headers =
    payload.headers && typeof payload.headers === "object" && !Array.isArray(payload.headers)
      ? payload.headers
      : {};
  const body = typeof payload.body === "string" ? payload.body : undefined;

  if (!url) {
    return c.json({ ok: false, error: "Field 'url' is required." }, 400);
  }

  const target = validateTargetUrl(url);
  if (!target) {
    return c.json(
      {
        ok: false,
        error: allowPrivateNetworks()
          ? "Invalid target URL."
          : "Invalid or disallowed target URL (private networks are blocked)."
      },
      400
    );
  }

  let response: Response;
  try {
    response = await fetch(target.toString(), {
      method,
      headers,
      body: ["GET", "HEAD"].includes(method) ? undefined : body,
      signal: AbortSignal.timeout(getUpstreamTimeoutMs())
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const isTimeout = message.toLowerCase().includes("timeout");
    return c.json(
      {
        ok: false,
        error: isTimeout ? "Target request timed out." : "Target request failed."
      },
      isTimeout ? 504 : 502
    );
  }

  const responseText = await response.text();
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  const envelope = {
    ok: response.ok,
    status: response.status,
    headers: responseHeaders,
    body: responseText,
    error: response.ok ? undefined : `Target returned HTTP ${response.status}`
  };

  return c.json(envelope, response.ok ? 200 : 502);
});
