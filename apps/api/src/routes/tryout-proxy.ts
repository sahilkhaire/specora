import { Hono } from "hono";
import { proxyAllowPrivateNetworks, proxyEnabled, proxyMaxResponseBytes, proxyTimeoutMs } from "../config.js";
import { isRecord } from "../http/validate.js";
import { rateLimit } from "../http/rate-limit.js";
import { BlockedTargetError, ResponseTooLargeError, TargetTimeoutError, safeFetch } from "../http/safe-fetch.js";

const METHOD_PATTERN = /^[A-Z]{1,16}$/;
const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

export const tryoutProxyRoutes = new Hono();

/**
 * POST /proxy — relay a try-out request server-side (self-hosted only).
 * Contract: plan/30-execution/web-proxy-contract-checks.md. The envelope is
 * returned with HTTP 200 for upstream 2xx and 502 otherwise; `status` always
 * carries the upstream status when the target responded.
 */
tryoutProxyRoutes.post(
  "/proxy",
  rateLimit({ windowMs: 60 * 1000, max: 120, name: "proxy" }),
  async (c) => {
    if (!proxyEnabled()) {
      return c.json({ ok: false, error: "Try-out proxy is disabled on this server." }, 403);
    }

    let payload: unknown;
    try {
      payload = await c.req.json();
    } catch {
      return c.json({ ok: false, error: "Invalid JSON body." }, 400);
    }
    if (!isRecord(payload)) {
      return c.json({ ok: false, error: "Invalid JSON body." }, 400);
    }

    const url = typeof payload.url === "string" ? payload.url.trim() : "";
    if (!url) {
      return c.json({ ok: false, error: "Field 'url' is required." }, 400);
    }

    const rawMethod = typeof payload.method === "string" ? payload.method.trim().toUpperCase() : "";
    const method = METHOD_PATTERN.test(rawMethod) ? rawMethod : "GET";

    const headers: Record<string, string> = {};
    if (isRecord(payload.headers)) {
      for (const [name, value] of Object.entries(payload.headers)) {
        if (typeof value === "string" && HEADER_NAME_PATTERN.test(name) && !/[\r\n]/.test(value)) {
          headers[name] = value;
        }
      }
    }
    const body = typeof payload.body === "string" ? payload.body : undefined;

    try {
      const response = await safeFetch(url, {
        method,
        headers,
        body,
        timeoutMs: proxyTimeoutMs(),
        maxResponseBytes: proxyMaxResponseBytes(),
        allowPrivateNetworks: proxyAllowPrivateNetworks(),
      });
      const ok = response.status >= 200 && response.status < 300;
      return c.json(
        {
          ok,
          status: response.status,
          headers: response.headers,
          body: response.body,
          error: ok ? undefined : `Target returned HTTP ${response.status}`,
        },
        ok ? 200 : 502
      );
    } catch (error) {
      if (error instanceof BlockedTargetError) {
        return c.json({ ok: false, error: error.message }, 400);
      }
      if (error instanceof TargetTimeoutError) {
        return c.json({ ok: false, error: error.message }, 504);
      }
      if (error instanceof ResponseTooLargeError) {
        return c.json({ ok: false, error: error.message }, 502);
      }
      return c.json({ ok: false, error: "Target request failed." }, 502);
    }
  }
);
