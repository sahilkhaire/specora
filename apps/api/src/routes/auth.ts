import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { hashPassword, needsRehash, verifyPassword } from "../auth/password.js";
import { endUserSession, getUserIdFromRequest, startUserSession } from "../auth/session.js";
import { badRequest, conflict, unauthorized } from "../http/errors.js";
import { rateLimit } from "../http/rate-limit.js";
import { isValidEmail, optionalString, readJsonObject } from "../http/validate.js";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 256;

/** Equalises login timing for unknown emails so responses don't reveal which accounts exist. */
let dummyHash: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword("specora-timing-equaliser");
  return dummyHash;
}

export const authRoutes = new Hono();

const credentialLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, name: "sign-in" });

authRoutes.get("/me", (c) => {
  const userId = getUserIdFromRequest(c);
  if (!userId) {
    return c.json({ user: null });
  }

  const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
  return c.json({ user: user ? { id: user.id, email: user.email } : null });
});

authRoutes.post("/signup", credentialLimiter, async (c) => {
  const body = await readJsonObject(c);
  const email = (optionalString(body, "email", 254) ?? "").trim().toLowerCase();
  const password = optionalString(body, "password", MAX_PASSWORD_LENGTH) ?? "";

  if (!isValidEmail(email)) {
    throw badRequest("A valid email address is required.");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw badRequest(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const passwordHash = await hashPassword(password);
  const userId = crypto.randomUUID();

  const created = db.transaction((tx) => {
    const existing = tx.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).get();
    if (existing) return false;
    tx.insert(schema.users).values({ id: userId, email, passwordHash, createdAt: new Date().toISOString() }).run();
    tx.insert(schema.userState)
      .values({ userId, activeWorkspaceId: "", environmentsJson: "[]", activeEnvironmentId: "" })
      .run();
    return true;
  });

  if (!created) {
    throw conflict("Email already registered.");
  }

  startUserSession(c, userId);
  return c.json({ ok: true, user: { id: userId, email } }, 201);
});

authRoutes.post("/login", credentialLimiter, async (c) => {
  const body = await readJsonObject(c);
  const email = (optionalString(body, "email", 254) ?? "").trim().toLowerCase();
  const password = optionalString(body, "password", MAX_PASSWORD_LENGTH) ?? "";

  const user = email ? db.select().from(schema.users).where(eq(schema.users.email, email)).get() : undefined;
  const valid = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !valid) {
    throw unauthorized("Invalid email or password.");
  }

  if (needsRehash(user.passwordHash)) {
    const upgraded = await hashPassword(password);
    db.update(schema.users).set({ passwordHash: upgraded }).where(eq(schema.users.id, user.id)).run();
  }

  startUserSession(c, user.id);
  return c.json({ ok: true, user: { id: user.id, email: user.email } });
});

authRoutes.post("/logout", (c) => {
  endUserSession(c);
  return c.json({ ok: true });
});
