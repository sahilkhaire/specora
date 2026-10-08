import { useCallback, useEffect, useRef, useState } from "react";
import { useDataContext } from "@/data/DataProvider";
import type { Workspace, SpecSource } from "./workspace-types";

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

function normalizeWorkspaces(raw: unknown[]): Workspace[] {
  return raw.map(normalizeWorkspace).filter((w): w is Workspace => w !== null);
}

export function useWorkspaces() {
  const { stores } = useDataContext();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let list: unknown[] = [];
      let activeId = "";
      try {
        [list, activeId] = await Promise.all([stores.workspaces.list(), stores.workspaces.getActiveId()]);
      } catch {
        /* backend unreachable: start empty rather than hanging un-hydrated */
      }
      if (cancelled) return;
      setWorkspaces(normalizeWorkspaces(list));
      setActiveWorkspaceId(activeId);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [stores]);

  useEffect(() => {
    if (!hydrated) return;
    if (workspaces.length === 0) {
      if (activeWorkspaceId) {
        setActiveWorkspaceId("");
        void stores.workspaces.setActiveId("");
      }
      return;
    }

    const hasActive = workspaces.some((w) => w.id === activeWorkspaceId);
    if (!hasActive) {
      const fallbackId = workspaces[0].id;
      setActiveWorkspaceId(fallbackId);
      void stores.workspaces.setActiveId(fallbackId);
    }
  }, [workspaces, activeWorkspaceId, hydrated, stores.workspaces]);

  // Mutations read the latest list from a ref so back-to-back calls don't overwrite each other.
  const workspacesRef = useRef(workspaces);
  workspacesRef.current = workspaces;
  const activeIdRef = useRef(activeWorkspaceId);
  activeIdRef.current = activeWorkspaceId;

  const persist = useCallback(
    (next: Workspace[], activeId = activeIdRef.current) => {
      workspacesRef.current = next;
      activeIdRef.current = activeId;
      setWorkspaces(next);
      setActiveWorkspaceId(activeId);
      void stores.workspaces.save(next).catch(() => {
        /* storage full or blocked */
      });
      void stores.workspaces.setActiveId(activeId).catch(() => undefined);
    },
    [stores.workspaces]
  );

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

    persist([...workspacesRef.current, newWorkspace], newWorkspace.id);
    return newWorkspace.id;
  }, [persist]);

  const updateWorkspace = useCallback((id: string, patch: Partial<Omit<Workspace, "id" | "createdAt">>): void => {
    persist(
      workspacesRef.current.map((w) => (w.id === id ? { ...w, ...patch, updatedAt: new Date().toISOString() } : w))
    );
  }, [persist]);

  const updateWorkspaceSpec = useCallback((
    id: string,
    specSource: SpecSource,
    spec: Record<string, unknown> | null
  ): void => {
    updateWorkspace(id, { specSource, spec });
  }, [updateWorkspace]);

  const renameWorkspace = useCallback((id: string, name: string, description?: string): void => {
    updateWorkspace(id, { name, description });
  }, [updateWorkspace]);

  const deleteWorkspace = useCallback((id: string): void => {
    const updated = workspacesRef.current.filter((w) => w.id !== id);
    const currentActive = activeIdRef.current;
    const nextId = currentActive === id ? (updated[0]?.id ?? "") : currentActive;
    persist(updated, nextId);
  }, [persist]);

  const switchWorkspace = useCallback((id: string): void => {
    activeIdRef.current = id;
    setActiveWorkspaceId(id);
    void stores.workspaces.setActiveId(id).catch(() => undefined);
  }, [stores.workspaces]);

  return {
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    hydrated,
    createWorkspace,
    updateWorkspace,
    updateWorkspaceSpec,
    renameWorkspace,
    deleteWorkspace,
    switchWorkspace,
  };
}
