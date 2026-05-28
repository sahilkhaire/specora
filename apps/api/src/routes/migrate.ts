import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { getUserIdFromRequest } from "../auth/session.js";

export const migrateRoutes = new Hono();

migrateRoutes.post("/migrate-guest", async (c) => {
  const userId = await getUserIdFromRequest(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json<{
    workspaces?: unknown[];
    activeWorkspaceId?: string;
    environments?: unknown[];
    activeEnvironmentId?: string;
    workflowBundles?: Array<{ workspaceId: string; workflows: unknown[] }>;
  }>();

  const workspaces = Array.isArray(body.workspaces) ? body.workspaces : [];
  await db.delete(schema.workspaces).where(eq(schema.workspaces.userId, userId));

  for (const raw of workspaces) {
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

  const environments = Array.isArray(body.environments) ? body.environments : [];
  await db
    .insert(schema.userState)
    .values({
      userId,
      activeWorkspaceId: body.activeWorkspaceId ?? "",
      environmentsJson: JSON.stringify(environments),
      activeEnvironmentId: body.activeEnvironmentId ?? "",
    })
    .onConflictDoUpdate({
      target: schema.userState.userId,
      set: {
        activeWorkspaceId: body.activeWorkspaceId ?? "",
        environmentsJson: JSON.stringify(environments),
        activeEnvironmentId: body.activeEnvironmentId ?? "",
      },
    });

  const bundles = Array.isArray(body.workflowBundles) ? body.workflowBundles : [];
  for (const bundle of bundles) {
    if (!bundle?.workspaceId) continue;
    await db.delete(schema.workflows).where(eq(schema.workflows.workspaceId, bundle.workspaceId));
    for (const raw of bundle.workflows ?? []) {
      if (!raw || typeof raw !== "object") continue;
      const w = raw as Record<string, unknown>;
      if (typeof w.id !== "string") continue;
      await db.insert(schema.workflows).values({
        id: w.id,
        workspaceId: bundle.workspaceId,
        payloadJson: JSON.stringify(raw),
      });
    }
  }

  return c.json({ ok: true });
});
