import type { WorkspaceCollectionState, RequestHistoryEntry } from "@/features/collections/collection-types";
import type { Environment } from "@/features/environments/env-types";
import type { Workflow } from "@/features/workflows/workflow-types";
import type { Workspace } from "@/features/workspaces/workspace-types";

export interface WorkspaceStore {
  list(): Promise<Workspace[]>;
  save(workspaces: Workspace[]): Promise<void>;
  getActiveId(): Promise<string>;
  setActiveId(id: string): Promise<void>;
}

export interface EnvironmentStore {
  list(): Promise<Environment[]>;
  save(environments: Environment[]): Promise<void>;
  getActiveId(): Promise<string>;
  setActiveId(id: string): Promise<void>;
}

export interface WorkflowStore {
  list(workspaceId: string): Promise<Workflow[]>;
  save(workspaceId: string, workflows: Workflow[]): Promise<void>;
}

export interface CollectionStore {
  load(workspaceId: string): Promise<WorkspaceCollectionState | null>;
  save(workspaceId: string, state: WorkspaceCollectionState): Promise<void>;
}

export interface HistoryStore {
  list(workspaceId: string): Promise<RequestHistoryEntry[]>;
  save(workspaceId: string, entries: RequestHistoryEntry[]): Promise<void>;
}

export interface AppDataStores {
  workspaces: WorkspaceStore;
  environments: EnvironmentStore;
  workflows: WorkflowStore;
  collections: CollectionStore;
  history: HistoryStore;
}

export type StorageBackend = "local" | "remote";
