import { Hono, type Context } from "hono";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { getCookie, setCookie } from "hono/cookie";

const ADMIN_COOKIE = "specora_admin";

export const adminRoutes = new Hono();

async function getDefaultInstance() {
  const rows = await db.select().from(schema.instances).limit(1);
  return rows[0] ?? null;
}

adminRoutes.post("/admin/login", async (c) => {
  const body = await c.req.json<{ password?: string }>();
  const instance = await getDefaultInstance();
  if (!instance || !verifyPassword(body.password ?? "", instance.adminPasswordHash)) {
    return c.json({ error: "Invalid admin credentials." }, 401);
  }

  setCookie(c, ADMIN_COOKIE, instance.id, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });

  return c.json({ ok: true });
});

async function requireAdmin(c: Context): Promise<string | Response> {
  const instanceId = getCookie(c, ADMIN_COOKIE);
  if (!instanceId) {
    return c.json({ error: "Admin auth required." }, 401);
  }
  return instanceId;
}

adminRoutes.get("/admin/instance", async (c) => {
  const instanceId = await requireAdmin(c);
  if (instanceId instanceof Response) return instanceId;

  const rows = await db.select().from(schema.instances).where(eq(schema.instances.id, instanceId)).limit(1);
  const instance = rows[0];
  if (!instance) {
    return c.json({ error: "Instance not found." }, 404);
  }

  return c.json({
    id: instance.id,
    name: instance.name,
    visibility: instance.visibility,
    baseDomain: instance.baseDomain,
  });
});

adminRoutes.put("/admin/instance", async (c) => {
  const instanceId = await requireAdmin(c);
  if (instanceId instanceof Response) return instanceId;

  const body = await c.req.json<{
    name?: string;
    visibility?: string;
    baseDomain?: string;
  }>();

  await db
    .update(schema.instances)
    .set({
      name: body.name,
      visibility: body.visibility,
      baseDomain: body.baseDomain,
    })
    .where(eq(schema.instances.id, instanceId));

  return c.json({ ok: true });
});

adminRoutes.post("/admin/spec/refresh", async (c) => {
  const instanceId = await requireAdmin(c);
  if (instanceId instanceof Response) return instanceId;

  const body = await c.req.json<{ workspaceId?: string; specUrl?: string }>();
  if (!body.workspaceId || !body.specUrl) {
    return c.json({ error: "workspaceId and specUrl required." }, 400);
  }

  const response = await fetch(body.specUrl);
  if (!response.ok) {
    return c.json({ error: `Failed to fetch spec (HTTP ${response.status})` }, 502);
  }

  const text = await response.text();
  let spec: Record<string, unknown>;
  try {
    spec = text.trim().startsWith("{") ? JSON.parse(text) : JSON.parse(text);
  } catch {
    return c.json({ error: "Invalid spec format." }, 400);
  }

  await db
    .update(schema.workspaces)
    .set({
      specJson: JSON.stringify(spec),
      specSourceJson: JSON.stringify({ type: "url", value: body.specUrl }),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.workspaces.id, body.workspaceId));

  return c.json({ ok: true });
});

export async function ensureDefaultInstance(): Promise<void> {
  const existing = await getDefaultInstance();
  if (existing) return;

  const adminPassword = process.env.SPECORA_ADMIN_PASSWORD ?? "specora-admin";
  await db.insert(schema.instances).values({
    id: crypto.randomUUID(),
    name: "Default Instance",
    visibility: "private",
    baseDomain: process.env.INSTANCE_BASE_DOMAIN ?? "localhost",
    adminPasswordHash: hashPassword(adminPassword),
    createdAt: new Date().toISOString(),
  });
}
