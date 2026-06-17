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
import { readScopedJson, readScopedItem, writeScopedItem, writeScopedJson } from "./scoped-storage";
import {
  getPersistedActiveWorkspaceId,
  loadPersistedWorkspaces,
  savePersistedWorkspaces,
  setPersistedActiveWorkspaceId,
} from "./workspace-persistence";

const ENVS_KEY = "environments";
const ACTIVE_ENV_KEY = "activeEnvId";
const WORKFLOWS_PREFIX = "workflows:";
const COLLECTIONS_PREFIX = "collections:";
const HISTORY_PREFIX = "history:";

function readJson<T>(key: string, fallback: T): T {
  return readScopedJson(key, fallback);
}

function writeJson(key: string, value: unknown): void {
  writeScopedJson(key, value);
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
    return readScopedItem(ACTIVE_ENV_KEY) ?? "";
  },
  async setActiveId(id) {
    writeScopedItem(ACTIVE_ENV_KEY, id);
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
