import { serve } from "@hono/node-server";
import { adminPassword, cookieSecure, isProduction, port, proxyEnabled } from "./config.js";
import { closeDb, initDb } from "./db/client.js";
import { pruneExpiredSessions } from "./auth/session.js";
import { ensureDefaultInstance } from "./routes/admin.js";
import { createApp } from "./app.js";

initDb();
await ensureDefaultInstance();
pruneExpiredSessions();

if (isProduction() && !cookieSecure()) {
  console.warn("[api] COOKIE_SECURE=false in production: session cookies will be sent over plain HTTP.");
}
if (proxyEnabled()) {
  console.log("[api] Try-out proxy enabled at POST /proxy.");
}
if (!adminPassword()) {
  console.log("[api] Admin routes disabled (set SPECORA_ADMIN_PASSWORD to enable).");
}

const app = createApp();
const server = serve({ fetch: app.fetch, port: port() }, (info) => {
  console.log(`Specora API listening on http://localhost:${info.port}`);
});

const pruneTimer = setInterval(pruneExpiredSessions, 60 * 60 * 1000);
pruneTimer.unref();

function shutdown(signal: string): void {
  console.log(`[api] ${signal} received, shutting down.`);
  clearInterval(pruneTimer);
  server.close(() => {
    closeDb();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
