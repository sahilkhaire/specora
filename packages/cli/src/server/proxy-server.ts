import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { Server } from "node:http";

function applyCorsHeaders(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) {
    return {};
  }

  return JSON.parse(raw) as Record<string, unknown>;
}

const DEFAULT_UPSTREAM_TIMEOUT_MS = 10_000;

function getUpstreamTimeoutMs(): number {
  const raw = process.env.SPECORA_PROXY_TIMEOUT_MS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_UPSTREAM_TIMEOUT_MS;
}

function tryParseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

export function startProxyServer(port: number): Server {
  const proxyServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    applyCorsHeaders(res);

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method !== "POST" || req.url !== "/proxy") {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: false, error: "Use POST /proxy" }));
      return;
    }

    try {
      const payload = await readJsonBody(req);
      const url = typeof payload.url === "string" ? payload.url : "";
      const method = typeof payload.method === "string" ? payload.method.toUpperCase() : "GET";
      const headers = (payload.headers && typeof payload.headers === "object")
        ? payload.headers as Record<string, string>
        : {};
      const body = typeof payload.body === "string" ? payload.body : undefined;

      if (!url) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ ok: false, error: "Field 'url' is required." }));
        return;
      }

      if (!tryParseUrl(url)) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ ok: false, error: "Invalid target URL." }));
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
        const message = error instanceof Error ? error.message : "";
        const isTimeout = message.toLowerCase().includes("timeout");
        res.statusCode = isTimeout ? 504 : 502;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({
          ok: false,
          error: isTimeout ? "Target request timed out." : "Target request failed."
        }));
        return;
      }

      const responseText = await response.text();
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      res.statusCode = response.ok ? 200 : 502;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({
        ok: response.ok,
        status: response.status,
        headers: responseHeaders,
        body: responseText,
        error: response.ok ? undefined : `Target returned HTTP ${response.status}`
      }));
    } catch (error) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ ok: false, error: "Proxy request failed." }));
    }
  });

  proxyServer.listen(port, () => {
    console.log(`Specora proxy listening at http://localhost:${port}/proxy`);
  });

  return proxyServer;
}
