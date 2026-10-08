import { createHash, randomBytes } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { CookieOptions } from "hono/utils/cookie";
import { cookieDomain, cookieSecure } from "../config.js";
import { db, schema } from "../db/client.js";

const SESSION_COOKIE = "specora_session";
const SESSION_DAYS = 14;
const ADMIN_COOKIE = "specora_admin";
const ADMIN_SESSION_HOURS = 12;

/** Opaque random token for the cookie; only its SHA-256 is stored, so a DB leak exposes no live sessions. */
function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function cookieOptions(maxAgeSeconds: number): CookieOptions {
  return {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "Lax",
    path: "/",
    domain: cookieDomain(),
    maxAge: maxAgeSeconds,
  };
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

// ─── user sessions ──────────────────────────────────────────────────────────

export function startUserSession(c: Context, userId: string): void {
  const token = newToken();
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  db.insert(schema.sessions)
    .values({ id: hashToken(token), userId, expiresAt: new Date(Date.now() + maxAge * 1000).toISOString() })
    .run();
  setCookie(c, SESSION_COOKIE, token, cookieOptions(maxAge));
}

export function endUserSession(c: Context): void {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    db.delete(schema.sessions).where(eq(schema.sessions.id, hashToken(token))).run();
  }
  deleteCookie(c, SESSION_COOKIE, { path: "/", domain: cookieDomain(), secure: cookieSecure() });
}

export function revokeAllUserSessions(userId: string): void {
  db.delete(schema.sessions).where(eq(schema.sessions.userId, userId)).run();
}

export function getUserIdFromRequest(c: Context): string | null {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;

  const id = hashToken(token);
  const session = db.select().from(schema.sessions).where(eq(schema.sessions.id, id)).get();
  if (!session) return null;
  if (isExpired(session.expiresAt)) {
    db.delete(schema.sessions).where(eq(schema.sessions.id, id)).run();
    return null;
  }
  return session.userId;
}

// ─── admin sessions ─────────────────────────────────────────────────────────

export function startAdminSession(c: Context, instanceId: string): void {
  const token = newToken();
  const maxAge = ADMIN_SESSION_HOURS * 60 * 60;
  db.insert(schema.adminSessions)
    .values({ id: hashToken(token), instanceId, expiresAt: new Date(Date.now() + maxAge * 1000).toISOString() })
    .run();
  setCookie(c, ADMIN_COOKIE, token, cookieOptions(maxAge));
}

export function endAdminSession(c: Context): void {
  const token = getCookie(c, ADMIN_COOKIE);
  if (token) {
    db.delete(schema.adminSessions).where(eq(schema.adminSessions.id, hashToken(token))).run();
  }
  deleteCookie(c, ADMIN_COOKIE, { path: "/", domain: cookieDomain(), secure: cookieSecure() });
}

export function getAdminInstanceId(c: Context): string | null {
  const token = getCookie(c, ADMIN_COOKIE);
  if (!token) return null;

  const id = hashToken(token);
  const session = db.select().from(schema.adminSessions).where(eq(schema.adminSessions.id, id)).get();
  if (!session) return null;
  if (isExpired(session.expiresAt)) {
    db.delete(schema.adminSessions).where(eq(schema.adminSessions.id, id)).run();
    return null;
  }
  return session.instanceId;
}

export function revokeAllAdminSessions(): void {
  db.delete(schema.adminSessions).run();
}

/** Remove expired rows; called periodically by the server process. */
export function pruneExpiredSessions(): void {
  const now = new Date().toISOString();
  db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, now)).run();
  db.delete(schema.adminSessions).where(lt(schema.adminSessions.expiresAt, now)).run();
}
