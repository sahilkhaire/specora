import type { Context, MiddlewareHandler } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";
import { trustProxy } from "../config.js";

interface Bucket {
  count: number;
  resetAt: number;
}

export function clientIp(c: Context): string {
  if (trustProxy()) {
    const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
  }
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    // `app.request()` in tests has no socket.
    return "unknown";
  }
}

/**
 * Fixed-window, per-IP limiter held in process memory. Sufficient for a
 * single API instance; put a shared limiter (e.g. at the edge) in front of
 * horizontally scaled deployments.
 */
export function rateLimit(options: { windowMs: number; max: number; name: string }): MiddlewareHandler {
  const buckets = new Map<string, Bucket>();

  return async (c, next) => {
    const now = Date.now();
    const key = clientIp(c);
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) {
        if (b.resetAt <= now) buckets.delete(k);
      }
    }

    if (bucket.count > options.max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      c.header("Retry-After", String(retryAfter));
      return c.json({ error: `Too many ${options.name} attempts. Try again in ${retryAfter}s.` }, 429);
    }

    await next();
  };
}
