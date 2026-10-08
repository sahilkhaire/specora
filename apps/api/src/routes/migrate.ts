import { Hono } from "hono";
import { db, schema } from "../db/client.js";
import { requireUser } from "../auth/require-user.js";
import { isRecord, isValidId, optionalArray, optionalString, readJsonObject } from "../http/validate.js";
import {
  MAX_WORKSPACES_PER_USER,
  parseWorkspaceList,
  replaceUserWorkspaces,
  replaceWorkflows,
} from "../services/workspaces.js";

export const migrateRoutes = new Hono();

/** Replace the signed-in account's data with a guest (browser-local) export. */
migrateRoutes.post("/migrate-guest", async (c) => {
  const userId = requireUser(c);
  const body = await readJsonObject(c);

  const workspaces = parseWorkspaceList(optionalArray(body, "workspaces", MAX_WORKSPACES_PER_USER));
  const environments = optionalArray(body, "environments", 200).filter(isRecord);
  const bundles = optionalArray(body, "workflowBundles", MAX_WORKSPACES_PER_USER).filter(isRecord);
  const activeWorkspaceId = optionalString(body, "activeWorkspaceId", 128) ?? "";
  const activeEnvironmentId = optionalString(body, "activeEnvironmentId", 128) ?? "";
  const migratedIds = new Set(workspaces.map((w) => w.id));

  db.transaction((tx) => {
    replaceUserWorkspaces(tx, userId, workspaces);

    const state = {
      activeWorkspaceId,
      environmentsJson: JSON.stringify(environments),
      activeEnvironmentId,
    };
    tx.insert(schema.userState)
      .values({ userId, ...state })
      .onConflictDoUpdate({ target: schema.userState.userId, set: state })
      .run();

    for (const bundle of bundles) {
      // Only workspaces in this payload, which replaceUserWorkspaces just bound to this user.
      if (!isValidId(bundle.workspaceId) || !migratedIds.has(bundle.workspaceId)) continue;
      replaceWorkflows(tx, bundle.workspaceId, Array.isArray(bundle.workflows) ? bundle.workflows.slice(0, 500) : []);
    }
  });

  return c.json({ ok: true });
});
