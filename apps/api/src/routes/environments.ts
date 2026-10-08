import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { requireUser } from "../auth/require-user.js";
import { isRecord, optionalArray, optionalString, parseStoredJson, readJsonObject } from "../http/validate.js";

const MAX_ENVIRONMENTS = 200;

function readState(userId: string) {
  return db.select().from(schema.userState).where(eq(schema.userState.userId, userId)).get();
}

export const environmentsRoutes = new Hono();

environmentsRoutes.get("/", (c) => {
  const userId = requireUser(c);
  const state = readState(userId);
  return c.json({
    environments: parseStoredJson<unknown[]>(state?.environmentsJson, []),
    activeEnvironmentId: state?.activeEnvironmentId ?? "",
  });
});

environmentsRoutes.put("/", async (c) => {
  const userId = requireUser(c);
  const body = await readJsonObject(c);
  const environments = optionalArray(body, "environments", MAX_ENVIRONMENTS).filter(isRecord);
  const environmentsJson = JSON.stringify(environments);

  db.insert(schema.userState)
    .values({ userId, activeWorkspaceId: "", environmentsJson, activeEnvironmentId: "" })
    .onConflictDoUpdate({ target: schema.userState.userId, set: { environmentsJson } })
    .run();

  return c.json({ environments, activeEnvironmentId: readState(userId)?.activeEnvironmentId ?? "" });
});

environmentsRoutes.put("/active", async (c) => {
  const userId = requireUser(c);
  const body = await readJsonObject(c);
  const activeEnvironmentId = optionalString(body, "activeEnvironmentId", 128) ?? "";

  db.insert(schema.userState)
    .values({ userId, activeWorkspaceId: "", environmentsJson: "[]", activeEnvironmentId })
    .onConflictDoUpdate({ target: schema.userState.userId, set: { activeEnvironmentId } })
    .run();

  return c.json({ ok: true, activeEnvironmentId });
});
