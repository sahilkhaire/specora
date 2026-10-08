import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { secureHeaders } from "hono/secure-headers";
import { corsOrigins, maxBodyBytes } from "./config.js";
import { pingDb } from "./db/client.js";
import { ApiError, handleError } from "./http/errors.js";
import { adminRoutes } from "./routes/admin.js";
import { authRoutes } from "./routes/auth.js";
import { environmentsRoutes } from "./routes/environments.js";
import { migrateRoutes } from "./routes/migrate.js";
import { publishRoutes } from "./routes/publish.js";
import { tryoutProxyRoutes } from "./routes/tryout-proxy.js";
import { workspacesRoutes } from "./routes/workspaces.js";

export function createApp(): Hono {
  const app = new Hono();
  const origins = corsOrigins();

  app.use("*", secureHeaders({ crossOriginResourcePolicy: "cross-origin" }));
  app.use("*", cors({ origin: origins, credentials: true, maxAge: 600 }));
  // Rejects cross-site form posts; JSON requests are already gated by CORS preflight.
  app.use("*", csrf({ origin: origins }));
  app.use(
    "*",
    bodyLimit({
      maxSize: maxBodyBytes(),
      onError: () => {
        throw new ApiError(413, "Request body is too large.");
      },
    })
  );

  app.get("/health", (c) => {
    const dbOk = pingDb();
    return c.json({ ok: dbOk, db: dbOk ? "up" : "down" }, dbOk ? 200 : 503);
  });

  app.route("/", tryoutProxyRoutes);
  app.route("/auth", authRoutes);
  app.route("/workspaces", workspacesRoutes);
  app.route("/environments", environmentsRoutes);
  app.route("/", migrateRoutes);
  app.route("/", adminRoutes);
  app.route("/", publishRoutes);

  app.notFound((c) => c.json({ error: "Not found" }, 404));
  app.onError(handleError);

  return app;
}
