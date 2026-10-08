import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { requireUser } from "../auth/require-user.js";
import { badRequest } from "../http/errors.js";
import { isRecord, optionalArray, optionalString, parseStoredJson, readJsonObject } from "../http/validate.js";
import {
  MAX_WORKSPACES_PER_USER,
  listUserWorkspaces,
  parseWorkspaceList,
  replaceUserWorkspaces,
  replaceWorkflows,
  requireOwnedWorkspace,
  workspaceToJson,
} from "../services/workspaces.js";

const MAX_WORKFLOWS = 500;
const MAX_HISTORY_ENTRIES = 100;

function activeWorkspaceId(userId: string): string {
  return db.select().from(schema.userState).where(eq(schema.userState.userId, userId)).get()?.activeWorkspaceId ?? "";
}

function listResponse(userId: string) {
  return {
    workspaces: listUserWorkspaces(userId).map(workspaceToJson),
    activeWorkspaceId: activeWorkspaceId(userId),
  };
}

export const workspacesRoutes = new Hono();

workspacesRoutes.get("/", (c) => {
  const userId = requireUser(c);
  return c.json(listResponse(userId));
});

workspacesRoutes.put("/", async (c) => {
  const userId = requireUser(c);
  const body = await readJsonObject(c);
  const incoming = parseWorkspaceList(optionalArray(body, "workspaces", MAX_WORKSPACES_PER_USER));

  db.transaction((tx) => replaceUserWorkspaces(tx, userId, incoming));
  return c.json(listResponse(userId));
});

workspacesRoutes.put("/active", async (c) => {
  const userId = requireUser(c);
  const body = await readJsonObject(c);
  const activeWorkspaceId = optionalString(body, "activeWorkspaceId", 128) ?? "";

  db.insert(schema.userState)
    .values({ userId, activeWorkspaceId, environmentsJson: "[]", activeEnvironmentId: "" })
    .onConflictDoUpdate({ target: schema.userState.userId, set: { activeWorkspaceId } })
    .run();

  return c.json({ ok: true, activeWorkspaceId });
});

workspacesRoutes.get("/:workspaceId/workflows", (c) => {
  const userId = requireUser(c);
  const workspace = requireOwnedWorkspace(userId, c.req.param("workspaceId"));

  const rows = db.select().from(schema.workflows).where(eq(schema.workflows.workspaceId, workspace.id)).all();
  const workflows = rows.map((row) => parseStoredJson<unknown>(row.payloadJson, null)).filter(Boolean);
  return c.json({ workflows });
});

workspacesRoutes.put("/:workspaceId/workflows", async (c) => {
  const userId = requireUser(c);
  const workspace = requireOwnedWorkspace(userId, c.req.param("workspaceId"));
  const body = await readJsonObject(c);
  const workflows = optionalArray(body, "workflows", MAX_WORKFLOWS);

  db.transaction((tx) => replaceWorkflows(tx, workspace.id, workflows));
  return c.json({ ok: true });
});

workspacesRoutes.get("/:workspaceId/collection", (c) => {
  const userId = requireUser(c);
  const workspace = requireOwnedWorkspace(userId, c.req.param("workspaceId"));
  return c.json({ collection: parseStoredJson<unknown>(workspace.collectionJson, null) });
});

workspacesRoutes.put("/:workspaceId/collection", async (c) => {
  const userId = requireUser(c);
  const workspace = requireOwnedWorkspace(userId, c.req.param("workspaceId"));
  const body = await readJsonObject(c);
  const collection = body.collection ?? null;
  if (collection !== null && !isRecord(collection)) {
    throw badRequest("Field 'collection' must be an object or null.");
  }

  db.update(schema.workspaces)
    .set({ collectionJson: collection ? JSON.stringify(collection) : null, updatedAt: new Date().toISOString() })
    .where(eq(schema.workspaces.id, workspace.id))
    .run();
  return c.json({ ok: true });
});

workspacesRoutes.get("/:workspaceId/history", (c) => {
  const userId = requireUser(c);
  const workspace = requireOwnedWorkspace(userId, c.req.param("workspaceId"));
  return c.json({ history: parseStoredJson<unknown[]>(workspace.historyJson, []) });
});

workspacesRoutes.put("/:workspaceId/history", async (c) => {
  const userId = requireUser(c);
  const workspace = requireOwnedWorkspace(userId, c.req.param("workspaceId"));
  const body = await readJsonObject(c);
  const history = optionalArray(body, "history", 1000).filter(isRecord).slice(0, MAX_HISTORY_ENTRIES);

  db.update(schema.workspaces)
    .set({ historyJson: JSON.stringify(history), updatedAt: new Date().toISOString() })
    .where(eq(schema.workspaces.id, workspace.id))
    .run();
  return c.json({ ok: true });
});
