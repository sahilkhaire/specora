import { Hono, type Context } from "hono";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { getUserIdFromRequest } from "../auth/session.js";

function rowToWorkspace(row: typeof schema.workspaces.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    specSource: row.specSourceJson ? JSON.parse(row.specSourceJson) : null,
    spec: row.specJson ? JSON.parse(row.specJson) : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function requireUser(c: Context): Promise<string | Response> {
  const userId = await getUserIdFromRequest(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  return userId;
}

export const workspacesRoutes = new Hono();

workspacesRoutes.get("/", async (c) => {
  const userId = await requireUser(c);
  if (userId instanceof Response) return userId;

  const rows = await db.select().from(schema.workspaces).where(eq(schema.workspaces.userId, userId));
  const stateRows = await db.select().from(schema.userState).where(eq(schema.userState.userId, userId)).limit(1);

  return c.json({
    workspaces: rows.map(rowToWorkspace),
    activeWorkspaceId: stateRows[0]?.activeWorkspaceId ?? "",
  });
});

workspacesRoutes.put("/", async (c) => {
  const userId = await requireUser(c);
  if (userId instanceof Response) return userId;

  const body = await c.req.json<{ workspaces?: unknown[] }>();
  const list = Array.isArray(body.workspaces) ? body.workspaces : [];

  await db.delete(schema.workspaces).where(eq(schema.workspaces.userId, userId));

  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const w = raw as Record<string, unknown>;
    if (typeof w.id !== "string" || typeof w.name !== "string") continue;

    await db.insert(schema.workspaces).values({
      id: w.id,
      userId,
      instanceId: null,
      name: w.name,
      description: typeof w.description === "string" ? w.description : null,
      specSourceJson: w.specSource ? JSON.stringify(w.specSource) : null,
      specJson: w.spec ? JSON.stringify(w.spec) : null,
      createdAt: typeof w.createdAt === "string" ? w.createdAt : new Date().toISOString(),
      updatedAt: typeof w.updatedAt === "string" ? w.updatedAt : new Date().toISOString(),
    });
  }

  const rows = await db.select().from(schema.workspaces).where(eq(schema.workspaces.userId, userId));
  const stateRows = await db.select().from(schema.userState).where(eq(schema.userState.userId, userId)).limit(1);

  return c.json({
    workspaces: rows.map(rowToWorkspace),
    activeWorkspaceId: stateRows[0]?.activeWorkspaceId ?? "",
  });
});

workspacesRoutes.put("/active", async (c) => {
  const userId = await requireUser(c);
  if (userId instanceof Response) return userId;

  const body = await c.req.json<{ activeWorkspaceId?: string }>();
  const activeWorkspaceId = body.activeWorkspaceId ?? "";

  await db
    .insert(schema.userState)
    .values({
      userId,
      activeWorkspaceId,
      environmentsJson: "[]",
      activeEnvironmentId: "",
    })
    .onConflictDoUpdate({
      target: schema.userState.userId,
      set: { activeWorkspaceId },
    });

  return c.json({ ok: true, activeWorkspaceId });
});

workspacesRoutes.get("/:workspaceId/workflows", async (c) => {
  const userId = await requireUser(c);
  if (userId instanceof Response) return userId;

  const workspaceId = c.req.param("workspaceId");
  const owned = await db
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, workspaceId))
    .limit(1);

  if (!owned[0] || owned[0].userId !== userId) {
    return c.json({ error: "Not found" }, 404);
  }

  const rows = await db.select().from(schema.workflows).where(eq(schema.workflows.workspaceId, workspaceId));
  const workflows = rows.map((row) => JSON.parse(row.payloadJson));

  return c.json({ workflows });
});

workspacesRoutes.put("/:workspaceId/workflows", async (c) => {
  const userId = await requireUser(c);
  if (userId instanceof Response) return userId;

  const workspaceId = c.req.param("workspaceId");
  const owned = await db
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, workspaceId))
    .limit(1);

  if (!owned[0] || owned[0].userId !== userId) {
    return c.json({ error: "Not found" }, 404);
  }

  const body = await c.req.json<{ workflows?: unknown[] }>();
  const list = Array.isArray(body.workflows) ? body.workflows : [];

  await db.delete(schema.workflows).where(eq(schema.workflows.workspaceId, workspaceId));

  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const w = raw as Record<string, unknown>;
    if (typeof w.id !== "string") continue;
    await db.insert(schema.workflows).values({
      id: w.id,
      workspaceId,
      payloadJson: JSON.stringify(raw),
    });
  }

  return c.json({ ok: true });
});
