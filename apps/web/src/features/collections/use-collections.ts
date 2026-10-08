import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDataContext } from "@/data/DataProvider";
import { isSdkEmbeddedContext } from "@/config/deployment";
import { bootstrapCollectionFromSpec, computeSpecFingerprint, emptyState } from "./collection-bootstrap";
import { capExchangesForRequest, migrateCollectionState } from "./collection-migrate";
import type { CollectionNode, SavedExchange, SavedRequest, WorkspaceCollectionState } from "./collection-types";

type Updater = (prev: WorkspaceCollectionState) => WorkspaceCollectionState;

export function useCollections(workspaceId: string, spec: Record<string, unknown> | null) {
  const { stores } = useDataContext();
  const [state, setState] = useState<WorkspaceCollectionState>(emptyState());
  const [selectedRequestId, setSelectedRequestId] = useState("");
  /** Workspace whose collection `state` holds; guards against saving one workspace's data under another. */
  const [loadedWorkspaceId, setLoadedWorkspaceId] = useState<string | null>(null);
  const stateRef = useRef(state);
  const loaded = loadedWorkspaceId === workspaceId;

  const replaceState = useCallback((next: WorkspaceCollectionState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    replaceState(emptyState());
    setSelectedRequestId("");
    setLoadedWorkspaceId(null);

    if (!workspaceId) {
      setLoadedWorkspaceId("");
      return;
    }

    let cancelled = false;
    void (async () => {
      let data: WorkspaceCollectionState | null = null;
      try {
        data = await stores.collections.load(workspaceId);
      } catch {
        data = null;
      }
      if (cancelled) return;
      const migrated = migrateCollectionState(data as Parameters<typeof migrateCollectionState>[0]);
      replaceState(migrated);
      if (data && data.version !== 2) {
        void stores.collections.save(workspaceId, migrated).catch(() => undefined);
      }
      setLoadedWorkspaceId(workspaceId);
    })();

    return () => {
      cancelled = true;
    };
  }, [replaceState, stores.collections, workspaceId]);

  /** Apply an update against the latest state (not a render-time snapshot) and persist it. */
  const commit = useCallback(
    (updater: Updater) => {
      const next = updater(stateRef.current);
      if (next === stateRef.current) return;
      replaceState(next);
      if (workspaceId) {
        void stores.collections.save(workspaceId, next).catch(() => undefined);
      }
    },
    [replaceState, stores.collections, workspaceId]
  );

  useEffect(() => {
    if (!workspaceId || !spec || !loaded) return;
    commit((prev) => {
      const fingerprint = computeSpecFingerprint(spec);
      if (prev.specFingerprint === fingerprint && prev.nodes.length > 0) {
        return prev;
      }

      const embedded = isSdkEmbeddedContext();
      const fingerprintChanged = prev.specFingerprint !== "" && prev.specFingerprint !== fingerprint;
      const hasExisting = prev.nodes.length > 0 || prev.requests.length > 0;
      const existing = hasExisting && (!embedded || !fingerprintChanged) ? prev : null;
      return bootstrapCollectionFromSpec(spec, existing);
    });
  }, [commit, spec, workspaceId, loaded]);

  const persist = useCallback((next: WorkspaceCollectionState) => commit(() => next), [commit]);

  const getRequest = useCallback(
    (id: string): SavedRequest | undefined => state.requests.find((r) => r.id === id),
    [state.requests]
  );

  const updateRequest = useCallback(
    (id: string, patch: Partial<SavedRequest>) => {
      commit((prev) => ({
        ...prev,
        requests: prev.requests.map((r) =>
          r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r
        )
      }));
    },
    [commit]
  );

  const addCustomRequest = useCallback(
    (node: CollectionNode, request: SavedRequest) => {
      commit((prev) => ({
        ...prev,
        nodes: [...prev.nodes, node],
        requests: [...prev.requests, request]
      }));
      setSelectedRequestId(request.id);
    },
    [commit]
  );

  const importFromPostman = useCallback(
    (nodes: CollectionNode[], requests: SavedRequest[]) => {
      commit((prev) => ({
        ...prev,
        nodes: [...prev.nodes, ...nodes],
        requests: [...prev.requests, ...requests]
      }));
    },
    [commit]
  );

  const getExchangesForRequest = useCallback(
    (savedRequestId: string): SavedExchange[] => {
      return state.exchanges
        .filter((e) => e.savedRequestId === savedRequestId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
    [state.exchanges]
  );

  const addExchange = useCallback(
    (exchange: SavedExchange) => {
      commit((prev) => ({
        ...prev,
        exchanges: capExchangesForRequest([exchange, ...prev.exchanges], exchange.savedRequestId)
      }));
    },
    [commit]
  );

  const removeExchange = useCallback(
    (id: string) => {
      commit((prev) => ({
        ...prev,
        exchanges: prev.exchanges.filter((e) => e.id !== id)
      }));
    },
    [commit]
  );

  const selectedRequest = selectedRequestId ? getRequest(selectedRequestId) : undefined;

  const exchangesForSelected = useMemo(
    () => (selectedRequestId ? getExchangesForRequest(selectedRequestId) : []),
    [getExchangesForRequest, selectedRequestId]
  );

  useEffect(() => {
    const selectionMissing = !selectedRequestId || !state.requests.some((r) => r.id === selectedRequestId);
    if (selectionMissing && state.requests.length > 0) {
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
    getExchangesForRequest,
    addExchange,
    removeExchange,
    exchangesForSelected,
    persist
  };
}
