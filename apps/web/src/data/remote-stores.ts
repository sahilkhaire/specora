import type { WorkspaceCollectionState, RequestHistoryEntry } from "@/features/collections/collection-types";
import type { Environment } from "@/features/environments/env-types";
import type { Workflow } from "@/features/workflows/workflow-types";
import type { Workspace } from "@/features/workspaces/workspace-types";
import { apiFetch } from "./api-client";
import type { AppDataStores } from "./types";
import type { GuestExportPayload } from "./guest-export";

interface MeResponse {
  user: { id: string; email: string } | null;
}

interface WorkspaceListResponse {
  workspaces: Workspace[];
  activeWorkspaceId: string;
}

interface EnvironmentListResponse {
  environments: Environment[];
  activeEnvironmentId: string;
}

interface WorkflowListResponse {
  workflows: Workflow[];
}

interface CollectionResponse {
  collection: WorkspaceCollectionState | null;
}

interface HistoryResponse {
  history: RequestHistoryEntry[];
}

export async function fetchCurrentUser(): Promise<MeResponse["user"]> {
  const data = await apiFetch<MeResponse>("/auth/me");
  return data.user;
}

export async function signup(email: string, password: string): Promise<void> {
  await apiFetch("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function login(email: string, password: string): Promise<void> {
  await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function logout(): Promise<void> {
  await apiFetch("/auth/logout", { method: "POST" });
}

export async function migrateGuest(payload: GuestExportPayload): Promise<void> {
  await apiFetch("/migrate-guest", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createRemoteStores(): AppDataStores {
  return {
    workspaces: {
      async list() {
        const data = await apiFetch<WorkspaceListResponse>("/workspaces");
        return data.workspaces;
      },
      async save(workspaces) {
        await apiFetch("/workspaces", {
          method: "PUT",
          body: JSON.stringify({ workspaces }),
        });
      },
      async getActiveId() {
        const data = await apiFetch<WorkspaceListResponse>("/workspaces");
        return data.activeWorkspaceId;
      },
      async setActiveId(id) {
        await apiFetch("/workspaces/active", {
          method: "PUT",
          body: JSON.stringify({ activeWorkspaceId: id }),
        });
      },
    },
    environments: {
      async list() {
        const data = await apiFetch<EnvironmentListResponse>("/environments");
        return data.environments;
      },
      async save(environments) {
        await apiFetch("/environments", {
          method: "PUT",
          body: JSON.stringify({ environments }),
        });
      },
      async getActiveId() {
        const data = await apiFetch<EnvironmentListResponse>("/environments");
        return data.activeEnvironmentId;
      },
      async setActiveId(id) {
        await apiFetch("/environments/active", {
          method: "PUT",
          body: JSON.stringify({ activeEnvironmentId: id }),
        });
      },
    },
    workflows: {
      async list(workspaceId) {
        const data = await apiFetch<WorkflowListResponse>(
          `/workspaces/${encodeURIComponent(workspaceId)}/workflows`
        );
        return data.workflows;
      },
      async save(workspaceId, workflows) {
        await apiFetch(`/workspaces/${encodeURIComponent(workspaceId)}/workflows`, {
          method: "PUT",
          body: JSON.stringify({ workflows }),
        });
      },
    },
    collections: {
      async load(workspaceId) {
        const data = await apiFetch<CollectionResponse>(
          `/workspaces/${encodeURIComponent(workspaceId)}/collection`
        );
        return data.collection;
      },
      async save(workspaceId, state) {
        await apiFetch(`/workspaces/${encodeURIComponent(workspaceId)}/collection`, {
          method: "PUT",
          body: JSON.stringify({ collection: state }),
        });
      },
    },
    history: {
      async list(workspaceId) {
        const data = await apiFetch<HistoryResponse>(
          `/workspaces/${encodeURIComponent(workspaceId)}/history`
        );
        return data.history;
      },
      async save(workspaceId, entries) {
        await apiFetch(`/workspaces/${encodeURIComponent(workspaceId)}/history`, {
          method: "PUT",
          body: JSON.stringify({ history: entries }),
        });
      },
    },
  };
}
