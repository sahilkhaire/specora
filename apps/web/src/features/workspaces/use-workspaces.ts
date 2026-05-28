import { useState, useCallback, useEffect } from "react";
import type { Workspace, SpecSource } from "./workspace-types";

const WORKSPACES_KEY = "specora:workspaces";
const ACTIVE_WORKSPACE_KEY = "specora:activeWorkspaceId";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSpecSource(value: unknown): SpecSource | null {
  if (!isRecord(value) || typeof value.type !== "string" || typeof value.value !== "string") {
    return null;
  }

  if (value.type === "url" || value.type === "text") {
    return { type: value.type, value: value.value };
  }

  if (value.type === "file") {
    if (typeof value.fileName !== "string") {
      return null;
    }
    return { type: "file", value: value.value, fileName: value.fileName };
  }

  return null;
}

function normalizeWorkspace(value: unknown): Workspace | null {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.id !== "string" || !value.id.trim()) {
    return null;
  }

  if (typeof value.name !== "string" || !value.name.trim()) {
    return null;
  }

  if (typeof value.createdAt !== "string" || typeof value.updatedAt !== "string") {
    return null;
  }

  const description = typeof value.description === "string" && value.description.trim()
    ? value.description
    : undefined;
  const spec = isRecord(value.spec) ? value.spec : null;
  const specSource = normalizeSpecSource(value.specSource);

  return {
    id: value.id,
    name: value.name,
    description,
    spec,
    specSource,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function loadWorkspaces(): Workspace[] {
  try {
    const raw = localStorage.getItem(WORKSPACES_KEY);
    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(normalizeWorkspace).filter((workspace): workspace is Workspace => workspace !== null);
  } catch {
    return [];
  }
}

function persistWorkspaces(workspaces: Workspace[]): void {
  try {
    localStorage.setItem(WORKSPACES_KEY, JSON.stringify(workspaces));
  } catch {
    // Ignore storage failures to keep UI usable.
  }
}

function loadActiveWorkspaceId(): string {
  try {
    const value = localStorage.getItem(ACTIVE_WORKSPACE_KEY);
    return typeof value === "string" ? value : "";
  } catch {
    return "";
  }
}

function persistActiveWorkspaceId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
  } catch {
    // Ignore storage failures to keep UI usable.
  }
}

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(loadWorkspaces);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(loadActiveWorkspaceId);

  useEffect(() => {
    if (workspaces.length === 0) {
      if (activeWorkspaceId) {
        setActiveWorkspaceId("");
        persistActiveWorkspaceId("");
      }
      return;
    }

    const hasActiveWorkspace = workspaces.some((w) => w.id === activeWorkspaceId);
    if (!hasActiveWorkspace) {
      const fallbackId = workspaces[0].id;
      setActiveWorkspaceId(fallbackId);
      persistActiveWorkspaceId(fallbackId);
    }
  }, [workspaces, activeWorkspaceId]);

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

  const renameWorkspace = useCallback((
    id: string,
    name: string,
    description?: string
  ): void => {
    updateWorkspace(id, { name, description });
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
    renameWorkspace,
    deleteWorkspace,
    switchWorkspace,
  };
}
