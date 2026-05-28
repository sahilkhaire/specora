import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { getUserIdFromRequest } from "../auth/session.js";

export const environmentsRoutes = new Hono();

environmentsRoutes.get("/", async (c) => {
  const userId = await getUserIdFromRequest(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const stateRows = await db.select().from(schema.userState).where(eq(schema.userState.userId, userId)).limit(1);
  const state = stateRows[0];

  return c.json({
    environments: state ? JSON.parse(state.environmentsJson) : [],
    activeEnvironmentId: state?.activeEnvironmentId ?? "",
  });
});

environmentsRoutes.put("/", async (c) => {
  const userId = await getUserIdFromRequest(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json<{ environments?: unknown[] }>();
  const environments = Array.isArray(body.environments) ? body.environments : [];

  await db
    .insert(schema.userState)
    .values({
      userId,
      activeWorkspaceId: "",
      environmentsJson: JSON.stringify(environments),
      activeEnvironmentId: "",
    })
    .onConflictDoUpdate({
      target: schema.userState.userId,
      set: { environmentsJson: JSON.stringify(environments) },
    });

  const stateRows = await db.select().from(schema.userState).where(eq(schema.userState.userId, userId)).limit(1);

  return c.json({
    environments,
    activeEnvironmentId: stateRows[0]?.activeEnvironmentId ?? "",
  });
});

environmentsRoutes.put("/active", async (c) => {
  const userId = await getUserIdFromRequest(c);
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json<{ activeEnvironmentId?: string }>();
  const activeEnvironmentId = body.activeEnvironmentId ?? "";

  await db
    .insert(schema.userState)
    .values({
      userId,
      activeWorkspaceId: "",
      environmentsJson: "[]",
      activeEnvironmentId,
    })
    .onConflictDoUpdate({
      target: schema.userState.userId,
      set: { activeEnvironmentId },
    });

  return c.json({ ok: true, activeEnvironmentId });
});
