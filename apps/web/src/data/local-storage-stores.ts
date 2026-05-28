import type { WorkspaceCollectionState, RequestHistoryEntry } from "@/features/collections/collection-types";
import type { Environment } from "@/features/environments/env-types";
import type { Workflow } from "@/features/workflows/workflow-types";
import type {
  AppDataStores,
  CollectionStore,
  EnvironmentStore,
  HistoryStore,
  WorkflowStore,
  WorkspaceStore
} from "./types";
import {
  getPersistedActiveWorkspaceId,
  loadPersistedWorkspaces,
  savePersistedWorkspaces,
  setPersistedActiveWorkspaceId,
} from "./workspace-persistence";

const ENVS_KEY = "specora:environments";
const ACTIVE_ENV_KEY = "specora:activeEnvId";
const WORKFLOWS_PREFIX = "specora:workflows:";
const COLLECTIONS_PREFIX = "specora:collections:";
const HISTORY_PREFIX = "specora:history:";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Keep UI usable when storage is full or blocked.
  }
}

const workspaceStore: WorkspaceStore = {
  async list() {
    return loadPersistedWorkspaces();
  },
  async save(workspaces) {
    await savePersistedWorkspaces(workspaces);
  },
  async getActiveId() {
    return getPersistedActiveWorkspaceId();
  },
  async setActiveId(id) {
    await setPersistedActiveWorkspaceId(id);
  },
};

const environmentStore: EnvironmentStore = {
  async list() {
    return readJson<Environment[]>(ENVS_KEY, []);
  },
  async save(environments) {
    writeJson(ENVS_KEY, environments);
  },
  async getActiveId() {
    try {
      return localStorage.getItem(ACTIVE_ENV_KEY) ?? "";
    } catch {
      return "";
    }
  },
  async setActiveId(id) {
    try {
      localStorage.setItem(ACTIVE_ENV_KEY, id);
    } catch {
      /* noop */
    }
  },
};

const workflowStore: WorkflowStore = {
  async list(workspaceId) {
    if (!workspaceId) return [];
    return readJson<Workflow[]>(`${WORKFLOWS_PREFIX}${workspaceId}`, []);
  },
  async save(workspaceId, workflows) {
    if (!workspaceId) return;
    writeJson(`${WORKFLOWS_PREFIX}${workspaceId}`, workflows);
  },
};

const collectionStore: CollectionStore = {
  async load(workspaceId) {
    if (!workspaceId) return null;
    return readJson<WorkspaceCollectionState | null>(`${COLLECTIONS_PREFIX}${workspaceId}`, null);
  },
  async save(workspaceId, state) {
    if (!workspaceId) return;
    writeJson(`${COLLECTIONS_PREFIX}${workspaceId}`, state);
  }
};

const historyStore: HistoryStore = {
  async list(workspaceId) {
    if (!workspaceId) return [];
    return readJson<RequestHistoryEntry[]>(`${HISTORY_PREFIX}${workspaceId}`, []);
  },
  async save(workspaceId, entries) {
    if (!workspaceId) return;
    writeJson(`${HISTORY_PREFIX}${workspaceId}`, entries.slice(0, 100));
  }
};

export function createLocalStorageStores(): AppDataStores {
  return {
    workspaces: workspaceStore,
    environments: environmentStore,
    workflows: workflowStore,
    collections: collectionStore,
    history: historyStore
  };
}

