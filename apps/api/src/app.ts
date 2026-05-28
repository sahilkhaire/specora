import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRoutes } from "./routes/auth.js";
import { workspacesRoutes } from "./routes/workspaces.js";
import { environmentsRoutes } from "./routes/environments.js";
import { migrateRoutes } from "./routes/migrate.js";
import { adminRoutes } from "./routes/admin.js";
import { publishRoutes } from "./routes/publish.js";
import { tryoutProxyRoutes } from "./routes/tryout-proxy.js";

export function createApp(): Hono {
  const app = new Hono();
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
    : ["https://specora.varcore.dev", "http://localhost:5173"];

  app.use(
    "*",
    cors({
      origin: allowedOrigins,
      credentials: true,
    })
  );

  app.get("/health", (c) => c.json({ ok: true }));
  app.route("/", tryoutProxyRoutes);

  app.route("/auth", authRoutes);
  app.route("/workspaces", workspacesRoutes);
  app.route("/environments", environmentsRoutes);
  app.route("/", migrateRoutes);
  app.route("/", adminRoutes);
  app.route("/", publishRoutes);

  return app;
}
