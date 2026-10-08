import { Hono, type Context } from "hono";
import { eq } from "drizzle-orm";
import { parseSpecTextSync } from "@specora/core";
import { db, schema } from "../db/client.js";
import { hashPassword, needsRehash, verifyPassword } from "../auth/password.js";
import { endAdminSession, getAdminInstanceId, revokeAllAdminSessions, startAdminSession } from "../auth/session.js";
import { adminPassword, platformDocsDomain, proxyAllowPrivateNetworks, proxyMaxResponseBytes, proxyTimeoutMs } from "../config.js";
import { ApiError, badRequest, notFound, unauthorized } from "../http/errors.js";
import { rateLimit } from "../http/rate-limit.js";
import { BlockedTargetError, TargetTimeoutError, safeFetch } from "../http/safe-fetch.js";
import { optionalString, readJsonObject, requiredString } from "../http/validate.js";

const VISIBILITIES = new Set(["private", "public"]);
/** Stored when no admin password is configured; never matches any input. */
const DISABLED_HASH = "!disabled";

function getDefaultInstance() {
  return db.select().from(schema.instances).limit(1).get() ?? null;
}

function requireAdminEnabled(): void {
  if (!adminPassword()) {
    throw notFound("Admin is not enabled on this server.");
  }
}

function requireAdmin(c: Context): string {
  requireAdminEnabled();
  const instanceId = getAdminInstanceId(c);
  if (!instanceId) {
    throw unauthorized("Admin auth required.");
  }
  return instanceId;
}

export const adminRoutes = new Hono();

adminRoutes.post(
  "/admin/login",
  rateLimit({ windowMs: 15 * 60 * 1000, max: 10, name: "admin sign-in" }),
  async (c) => {
    requireAdminEnabled();
    const body = await readJsonObject(c);
    const password = optionalString(body, "password", 256) ?? "";
    const instance = getDefaultInstance();
    if (!instance || !(await verifyPassword(password, instance.adminPasswordHash))) {
      throw unauthorized("Invalid admin credentials.");
    }

    startAdminSession(c, instance.id);
    return c.json({ ok: true });
  }
);

adminRoutes.post("/admin/logout", (c) => {
  endAdminSession(c);
  return c.json({ ok: true });
});

adminRoutes.get("/admin/instance", (c) => {
  const instanceId = requireAdmin(c);
  const instance = db.select().from(schema.instances).where(eq(schema.instances.id, instanceId)).get();
  if (!instance) {
    throw notFound("Instance not found.");
  }

  return c.json({
    id: instance.id,
    name: instance.name,
    visibility: instance.visibility,
    baseDomain: instance.baseDomain,
  });
});

adminRoutes.put("/admin/instance", async (c) => {
  const instanceId = requireAdmin(c);
  const body = await readJsonObject(c);
  const name = optionalString(body, "name", 200)?.trim();
  const visibility = optionalString(body, "visibility", 20);
  const baseDomain = optionalString(body, "baseDomain", 253)?.trim().toLowerCase();

  if (visibility !== undefined && !VISIBILITIES.has(visibility)) {
    throw badRequest("Field 'visibility' must be 'private' or 'public'.");
  }

  const patch: Partial<typeof schema.instances.$inferInsert> = {};
  if (name) patch.name = name;
  if (visibility) patch.visibility = visibility;
  if (baseDomain !== undefined) patch.baseDomain = baseDomain || null;
  if (Object.keys(patch).length > 0) {
    db.update(schema.instances).set(patch).where(eq(schema.instances.id, instanceId)).run();
  }

  return c.json({ ok: true });
});

adminRoutes.post("/admin/spec/refresh", async (c) => {
  requireAdmin(c);
  const body = await readJsonObject(c);
  const workspaceId = requiredString(body, "workspaceId", 128);
  const specUrl = requiredString(body, "specUrl", 4096);

  const workspace = db.select({ id: schema.workspaces.id }).from(schema.workspaces).where(eq(schema.workspaces.id, workspaceId)).get();
  if (!workspace) {
    throw notFound("Workspace not found.");
  }

  let text: string;
  try {
    const response = await safeFetch(specUrl, {
      timeoutMs: proxyTimeoutMs(),
      maxResponseBytes: proxyMaxResponseBytes(),
      allowPrivateNetworks: proxyAllowPrivateNetworks(),
      headers: { accept: "application/json, application/yaml;q=0.9, */*;q=0.5" },
    });
    if (response.status < 200 || response.status >= 300) {
      throw new ApiError(502, `Failed to fetch spec (HTTP ${response.status}).`);
    }
    text = response.body;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof BlockedTargetError) throw badRequest(error.message);
    if (error instanceof TargetTimeoutError) throw new ApiError(504, error.message);
    throw new ApiError(502, "Failed to fetch spec.");
  }

  const parsed = parseSpecTextSync(text);
  if (!parsed.ok) {
    throw badRequest(parsed.error);
  }

  db.update(schema.workspaces)
    .set({
      specJson: JSON.stringify(parsed.spec),
      specSourceJson: JSON.stringify({ type: "url", value: specUrl }),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.workspaces.id, workspaceId))
    .run();

  return c.json({ ok: true });
});

/**
 * Create the singleton instance row and keep its admin password in sync with
 * `SPECORA_ADMIN_PASSWORD`, so rotating the env var rotates the credential.
 */
export async function ensureDefaultInstance(): Promise<void> {
  const password = adminPassword();
  const existing = getDefaultInstance();

  if (!existing) {
    db.insert(schema.instances)
      .values({
        id: crypto.randomUUID(),
        name: "Default Instance",
        visibility: "private",
        baseDomain: platformDocsDomain(),
        adminPasswordHash: password ? await hashPassword(password) : DISABLED_HASH,
        createdAt: new Date().toISOString(),
      })
      .run();
    return;
  }

  const upToDate = password
    ? await verifyPassword(password, existing.adminPasswordHash)
    : existing.adminPasswordHash === DISABLED_HASH;
  if (upToDate && !(password && needsRehash(existing.adminPasswordHash))) return;

  db.update(schema.instances)
    .set({ adminPasswordHash: password ? await hashPassword(password) : DISABLED_HASH })
    .where(eq(schema.instances.id, existing.id))
    .run();
  if (!upToDate) revokeAllAdminSessions();
}
