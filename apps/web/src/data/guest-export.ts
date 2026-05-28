import type { Environment } from "@/features/environments/env-types";
import type { Workflow } from "@/features/workflows/workflow-types";
import type { Workspace } from "@/features/workspaces/workspace-types";
import { createLocalStorageStores } from "./local-storage-stores";

export const GUEST_EXPORT_VERSION = 1 as const;

export interface GuestWorkflowBundle {
  workspaceId: string;
  workflows: Workflow[];
}

export interface GuestExportPayload {
  version: typeof GUEST_EXPORT_VERSION;
  exportedAt: string;
  workspaces: Workspace[];
  activeWorkspaceId: string;
  environments: Environment[];
  activeEnvironmentId: string;
  workflowBundles: GuestWorkflowBundle[];
}

export function isGuestExportPayload(value: unknown): value is GuestExportPayload {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.version === GUEST_EXPORT_VERSION
    && typeof record.exportedAt === "string"
    && Array.isArray(record.workspaces)
    && Array.isArray(record.environments)
    && Array.isArray(record.workflowBundles)
  );
}

export async function exportGuestData(): Promise<GuestExportPayload> {
  const stores = createLocalStorageStores();
  const workspaces = await stores.workspaces.list();
  const activeWorkspaceId = await stores.workspaces.getActiveId();
  const environments = await stores.environments.list();
  const activeEnvironmentId = await stores.environments.getActiveId();

  const workflowBundles: GuestWorkflowBundle[] = await Promise.all(
    workspaces.map(async (workspace) => ({
      workspaceId: workspace.id,
      workflows: await stores.workflows.list(workspace.id),
    }))
  );

  return {
    version: GUEST_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    workspaces,
    activeWorkspaceId,
    environments,
    activeEnvironmentId,
    workflowBundles,
  };
}

export async function importGuestData(payload: GuestExportPayload): Promise<void> {
  if (!isGuestExportPayload(payload)) {
    throw new Error("Invalid guest export payload.");
  }

  const stores = createLocalStorageStores();
  await stores.workspaces.save(payload.workspaces);
  await stores.workspaces.setActiveId(payload.activeWorkspaceId);
  await stores.environments.save(payload.environments);
  await stores.environments.setActiveId(payload.activeEnvironmentId);

  for (const bundle of payload.workflowBundles) {
    await stores.workflows.save(bundle.workspaceId, bundle.workflows);
  }
}
