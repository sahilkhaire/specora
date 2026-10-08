import { and, eq, inArray, notInArray } from "drizzle-orm";
import { db, schema, type Db } from "../db/client.js";
import { conflict, notFound } from "../http/errors.js";
import { isRecord, isValidId, parseStoredJson } from "../http/validate.js";

export const MAX_WORKSPACES_PER_USER = 200;

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type WorkspaceRow = typeof schema.workspaces.$inferSelect;

export interface WorkspaceInput {
  id: string;
  name: string;
  description: string | null;
  specSource: Record<string, unknown> | null;
  spec: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export function workspaceToJson(row: WorkspaceRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    specSource: parseStoredJson<Record<string, unknown> | null>(row.specSourceJson, null),
    spec: parseStoredJson<Record<string, unknown> | null>(row.specJson, null),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function isoOrNow(value: unknown): string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : new Date().toISOString();
}

/** Drop malformed entries and duplicates rather than failing a whole sync. */
export function parseWorkspaceList(raw: unknown[]): WorkspaceInput[] {
  const seen = new Set<string>();
  const result: WorkspaceInput[] = [];
  for (const item of raw) {
    if (!isRecord(item) || !isValidId(item.id) || seen.has(item.id)) continue;
    if (typeof item.name !== "string" || !item.name.trim()) continue;
    seen.add(item.id);
    result.push({
      id: item.id,
      name: item.name.trim().slice(0, 200),
      description: typeof item.description === "string" ? item.description.slice(0, 2000) : null,
      specSource: isRecord(item.specSource) ? item.specSource : null,
      spec: isRecord(item.spec) ? item.spec : null,
      createdAt: isoOrNow(item.createdAt),
      updatedAt: isoOrNow(item.updatedAt),
    });
  }
  return result;
}

function deleteWorkspaceChildren(tx: Tx, workspaceIds: string[]): void {
  if (workspaceIds.length === 0) return;
  tx.delete(schema.workflows).where(inArray(schema.workflows.workspaceId, workspaceIds)).run();
  tx.delete(schema.publishedSites).where(inArray(schema.publishedSites.workspaceId, workspaceIds)).run();
}

/**
 * Make the user's workspace set equal to `incoming`: upsert listed
 * workspaces (keeping their server-side collection and history) and delete
 * the rest. Must run inside a transaction.
 */
export function replaceUserWorkspaces(tx: Tx, userId: string, incoming: WorkspaceInput[]): void {
  const ids = incoming.map((w) => w.id);

  if (ids.length > 0) {
    const foreign = tx
      .select({ id: schema.workspaces.id, userId: schema.workspaces.userId })
      .from(schema.workspaces)
      .where(inArray(schema.workspaces.id, ids))
      .all()
      .filter((row) => row.userId !== userId);
    if (foreign.length > 0) {
      throw conflict("One or more workspace ids are already in use.");
    }
  }

  const removed = tx
    .select({ id: schema.workspaces.id })
    .from(schema.workspaces)
    .where(
      ids.length > 0
        ? and(eq(schema.workspaces.userId, userId), notInArray(schema.workspaces.id, ids))
        : eq(schema.workspaces.userId, userId)
    )
    .all()
    .map((row) => row.id);

  if (removed.length > 0) {
    deleteWorkspaceChildren(tx, removed);
    tx.delete(schema.workspaces).where(inArray(schema.workspaces.id, removed)).run();
  }

  for (const w of incoming) {
    const values = {
      name: w.name,
      description: w.description,
      specSourceJson: w.specSource ? JSON.stringify(w.specSource) : null,
      specJson: w.spec ? JSON.stringify(w.spec) : null,
      updatedAt: w.updatedAt,
    };
    tx.insert(schema.workspaces)
      .values({ id: w.id, userId, instanceId: null, createdAt: w.createdAt, ...values })
      .onConflictDoUpdate({ target: schema.workspaces.id, set: values })
      .run();
  }
}

export function listUserWorkspaces(userId: string): WorkspaceRow[] {
  return db.select().from(schema.workspaces).where(eq(schema.workspaces.userId, userId)).all();
}

/** 404 (not 403) for other users' workspaces so ids can't be probed. */
export function requireOwnedWorkspace(userId: string, workspaceId: string): WorkspaceRow {
  const row = isValidId(workspaceId)
    ? db.select().from(schema.workspaces).where(eq(schema.workspaces.id, workspaceId)).get()
    : undefined;
  if (!row || row.userId !== userId) {
    throw notFound();
  }
  return row;
}

export function replaceWorkflows(tx: Tx, workspaceId: string, raw: unknown[]): void {
  tx.delete(schema.workflows).where(eq(schema.workflows.workspaceId, workspaceId)).run();
  const seen = new Set<string>();
  for (const item of raw) {
    if (!isRecord(item) || !isValidId(item.id) || seen.has(item.id)) continue;
    seen.add(item.id);
    // Workflow ids are only unique per client; namespace the row key by workspace.
    tx.insert(schema.workflows)
      .values({ id: `${workspaceId}:${item.id}`, workspaceId, payloadJson: JSON.stringify(item) })
      .run();
  }
}
