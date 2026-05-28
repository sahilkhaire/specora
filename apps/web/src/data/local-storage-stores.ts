import type { Environment } from "@/features/environments/env-types";
import type { Workflow } from "@/features/workflows/workflow-types";
import type { AppDataStores, EnvironmentStore, WorkflowStore, WorkspaceStore } from "./types";
import {
  getPersistedActiveWorkspaceId,
  loadPersistedWorkspaces,
  savePersistedWorkspaces,
  setPersistedActiveWorkspaceId,
} from "./workspace-persistence";

const ENVS_KEY = "specora:environments";
const ACTIVE_ENV_KEY = "specora:activeEnvId";
const WORKFLOWS_PREFIX = "specora:workflows:";

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

export function createLocalStorageStores(): AppDataStores {
  return {
    workspaces: workspaceStore,
    environments: environmentStore,
    workflows: workflowStore,
  };
}
