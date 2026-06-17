import type { Workspace } from "@/features/workspaces/workspace-types";
import { readScopedJson, readScopedItem, writeScopedItem, writeScopedJson } from "./scoped-storage";
import { getScopedIndexedDbName } from "./storage-scope";

const WORKSPACES_KEY = "workspaces";
const ACTIVE_WORKSPACE_KEY = "activeWorkspaceId";
const LEGACY_DB_NAME = "specora";
const DB_VERSION = 1;
const SPEC_STORE = "workspace-specs";

type StoredWorkspaceRow = Omit<Workspace, "spec"> & {
  spec?: Record<string, unknown> | null;
  hasPersistedSpec?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function writeJson(key: string, value: unknown): boolean {
  return writeScopedJson(key, value);
}

function openSpecDb(dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }

    const request = indexedDB.open(dbName, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SPEC_STORE)) {
        db.createObjectStore(SPEC_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
}

async function idbPutSpec(workspaceId: string, spec: Record<string, unknown>): Promise<void> {
  const db = await openSpecDb(getScopedIndexedDbName());
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SPEC_STORE, "readwrite");
    tx.objectStore(SPEC_STORE).put(spec, workspaceId);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("IndexedDB write failed"));
    };
  });
}

async function idbGetSpecFromDb(
  dbName: string,
  workspaceId: string
): Promise<Record<string, unknown> | null> {
  const db = await openSpecDb(dbName);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SPEC_STORE, "readonly");
    const request = tx.objectStore(SPEC_STORE).get(workspaceId);
    request.onsuccess = () => {
      db.close();
      const value = request.result;
      resolve(isRecord(value) ? value : null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error ?? new Error("IndexedDB read failed"));
    };
  });
}

async function idbGetSpec(workspaceId: string): Promise<Record<string, unknown> | null> {
  try {
    const scoped = await idbGetSpecFromDb(getScopedIndexedDbName(), workspaceId);
    if (scoped) {
      return scoped;
    }

    const legacy = await idbGetSpecFromDb(LEGACY_DB_NAME, workspaceId);
    if (legacy) {
      await idbPutSpec(workspaceId, legacy);
    }
    return legacy;
  } catch {
    return null;
  }
}

async function idbDeleteSpec(workspaceId: string): Promise<void> {
  const db = await openSpecDb(getScopedIndexedDbName());
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SPEC_STORE, "readwrite");
    tx.objectStore(SPEC_STORE).delete(workspaceId);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("IndexedDB delete failed"));
    };
  });
}

export async function loadPersistedWorkspaces(): Promise<Workspace[]> {
  const stored = readScopedJson<StoredWorkspaceRow[]>(WORKSPACES_KEY, []);
  const workspaces: Workspace[] = [];

  for (const entry of stored) {
    let spec = isRecord(entry.spec) ? entry.spec : null;

    if (!spec) {
      try {
        spec = await idbGetSpec(entry.id);
      } catch {
        spec = null;
      }
    }

    workspaces.push({
      id: entry.id,
      name: entry.name,
      description: entry.description,
      specSource: entry.specSource ?? null,
      spec,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    });
  }

  return workspaces;
}

export async function savePersistedWorkspaces(workspaces: Workspace[]): Promise<void> {
  for (const workspace of workspaces) {
    try {
      if (workspace.spec) {
        await idbPutSpec(workspace.id, workspace.spec);
      } else {
        await idbDeleteSpec(workspace.id);
      }
    } catch {
      /* IndexedDB blocked or full — localStorage may still work */
    }
  }

  if (writeJson(WORKSPACES_KEY, workspaces)) {
    return;
  }

  const slim: StoredWorkspaceRow[] = workspaces.map((workspace) => ({
    id: workspace.id,
    name: workspace.name,
    description: workspace.description,
    specSource: workspace.specSource,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
    hasPersistedSpec: Boolean(workspace.spec),
  }));

  writeJson(WORKSPACES_KEY, slim);
}

export async function getPersistedActiveWorkspaceId(): Promise<string> {
  return readScopedItem(ACTIVE_WORKSPACE_KEY) ?? "";
}

export async function setPersistedActiveWorkspaceId(id: string): Promise<void> {
  writeScopedItem(ACTIVE_WORKSPACE_KEY, id);
}
