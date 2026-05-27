import { useState, useCallback } from "react";
import type { Workspace, SpecSource } from "./workspace-types";

const WORKSPACES_KEY = "specora:workspaces";
const ACTIVE_WORKSPACE_KEY = "specora:activeWorkspaceId";

function loadWorkspaces(): Workspace[] {
  try {
    const raw = localStorage.getItem(WORKSPACES_KEY);
    return raw ? (JSON.parse(raw) as Workspace[]) : [];
  } catch {
    return [];
  }
}

function persistWorkspaces(workspaces: Workspace[]): void {
  localStorage.setItem(WORKSPACES_KEY, JSON.stringify(workspaces));
}

function loadActiveWorkspaceId(): string {
  return localStorage.getItem(ACTIVE_WORKSPACE_KEY) ?? "";
}

function persistActiveWorkspaceId(id: string): void {
  localStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
}

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(loadWorkspaces);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(loadActiveWorkspaceId);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;

  const createWorkspace = useCallback((name: string, description?: string): string => {
    const now = new Date().toISOString();
    const newWorkspace: Workspace = {
      id: crypto.randomUUID(),
      name,
      description,
      specSource: null,
      spec: null,
      createdAt: now,
      updatedAt: now,
    };
    
    const updated = [...workspaces, newWorkspace];
    setWorkspaces(updated);
    persistWorkspaces(updated);
    
    // Auto-select the new workspace
    setActiveWorkspaceId(newWorkspace.id);
    persistActiveWorkspaceId(newWorkspace.id);
    
    return newWorkspace.id;
  }, [workspaces]);

  const updateWorkspace = useCallback((id: string, patch: Partial<Omit<Workspace, "id" | "createdAt">>): void => {
    const updated = workspaces.map((w) => {
      if (w.id === id) {
        return {
          ...w,
          ...patch,
          updatedAt: new Date().toISOString(),
        };
      }
      return w;
    });
    
    setWorkspaces(updated);
    persistWorkspaces(updated);
  }, [workspaces]);

  const updateWorkspaceSpec = useCallback((
    id: string,
    specSource: SpecSource,
    spec: Record<string, unknown> | null
  ): void => {
    updateWorkspace(id, { specSource, spec });
  }, [updateWorkspace]);

  const deleteWorkspace = useCallback((id: string): void => {
    const updated = workspaces.filter((w) => w.id !== id);
    setWorkspaces(updated);
    persistWorkspaces(updated);
    
    // If deleting the active workspace, switch to the first available one
    if (activeWorkspaceId === id) {
      const nextId = updated[0]?.id ?? "";
      setActiveWorkspaceId(nextId);
      persistActiveWorkspaceId(nextId);
    }
  }, [workspaces, activeWorkspaceId]);

  const switchWorkspace = useCallback((id: string): void => {
    setActiveWorkspaceId(id);
    persistActiveWorkspaceId(id);
  }, []);

  return {
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    createWorkspace,
    updateWorkspace,
    updateWorkspaceSpec,
    deleteWorkspace,
    switchWorkspace,
  };
}
