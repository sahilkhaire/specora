import { useCallback, useEffect, useState } from "react";
import { useDataContext } from "@/data/DataProvider";
import { bootstrapCollectionFromSpec, computeSpecFingerprint, emptyState } from "./collection-bootstrap";
import type { CollectionNode, SavedRequest, WorkspaceCollectionState } from "./collection-types";

export function useCollections(workspaceId: string, spec: Record<string, unknown> | null) {
  const { stores } = useDataContext();
  const [state, setState] = useState<WorkspaceCollectionState>(emptyState());
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!workspaceId) {
      setState(emptyState());
      setLoaded(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      const data = await stores.collections.load(workspaceId);
      if (cancelled) return;
      setState(data ?? emptyState());
      setLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [stores.collections, workspaceId]);

  useEffect(() => {
    if (!workspaceId || !spec || !loaded) return;
    setState((prev) => {
      const fingerprint = computeSpecFingerprint(spec);
      if (prev.specFingerprint === fingerprint && prev.nodes.length > 0) {
        return prev;
      }
      const next = bootstrapCollectionFromSpec(
        spec,
        prev.nodes.length > 0 || prev.requests.length > 0 ? prev : null
      );
      void stores.collections.save(workspaceId, next);
      return next;
    });
  }, [spec, workspaceId, loaded, stores.collections]);

  const persist = useCallback(
    (next: WorkspaceCollectionState) => {
      setState(next);
      if (workspaceId) {
        void stores.collections.save(workspaceId, next);
      }
    },
    [stores.collections, workspaceId]
  );

  const getRequest = useCallback(
    (id: string): SavedRequest | undefined => state.requests.find((r) => r.id === id),
    [state.requests]
  );

  const updateRequest = useCallback(
    (id: string, patch: Partial<SavedRequest>) => {
      persist({
        ...state,
        requests: state.requests.map((r) =>
          r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r
        )
      });
    },
    [persist, state]
  );

  const addCustomRequest = useCallback(
    (node: CollectionNode, request: SavedRequest) => {
      persist({
        ...state,
        nodes: [...state.nodes, node],
        requests: [...state.requests, request]
      });
      setSelectedRequestId(request.id);
    },
    [persist, state]
  );

  const importFromPostman = useCallback(
    (nodes: CollectionNode[], requests: SavedRequest[]) => {
      persist({
        ...state,
        nodes: [...state.nodes, ...nodes],
        requests: [...state.requests, ...requests]
      });
    },
    [persist, state]
  );

  const selectedRequest = selectedRequestId ? getRequest(selectedRequestId) : undefined;

  useEffect(() => {
    if (!selectedRequestId && state.requests.length > 0) {
      setSelectedRequestId(state.requests[0]!.id);
    }
  }, [selectedRequestId, state.requests]);

  return {
    state,
    loaded,
    selectedRequestId,
    setSelectedRequestId,
    selectedRequest,
    getRequest,
    updateRequest,
    addCustomRequest,
    importFromPostman,
    persist
  };
}
