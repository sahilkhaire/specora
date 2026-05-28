import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import {
  clearSessionCookie,
  createSession,
  getUserIdFromRequest,
  setSessionCookie,
} from "../auth/session.js";

export const authRoutes = new Hono();

authRoutes.get("/me", async (c) => {
  const userId = await getUserIdFromRequest(c);
  if (!userId) {
    return c.json({ user: null });
  }

  const rows = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  const user = rows[0];
  if (!user) {
    return c.json({ user: null });
  }

  return c.json({ user: { id: user.id, email: user.email } });
});

authRoutes.post("/signup", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

  if (!email || password.length < 8) {
    return c.json({ error: "Valid email and password (8+ chars) required." }, 400);
  }

  const existing = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (existing[0]) {
    return c.json({ error: "Email already registered." }, 409);
  }

  const userId = crypto.randomUUID();
  await db.insert(schema.users).values({
    id: userId,
    email,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  });
  await db.insert(schema.userState).values({
    userId,
    activeWorkspaceId: "",
    environmentsJson: "[]",
    activeEnvironmentId: "",
  });

  const sessionId = await createSession(userId);
  setSessionCookie(c, sessionId);
  return c.json({ ok: true, user: { id: userId, email } });
});

authRoutes.post("/login", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

  const rows = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  const user = rows[0];
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return c.json({ error: "Invalid credentials." }, 401);
  }

  const sessionId = await createSession(user.id);
  setSessionCookie(c, sessionId);
  return c.json({ ok: true, user: { id: user.id, email: user.email } });
});

authRoutes.post("/logout", async (c) => {
  clearSessionCookie(c);
  return c.json({ ok: true });
});
