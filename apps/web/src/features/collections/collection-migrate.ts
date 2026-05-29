import type { SavedExchange, WorkspaceCollectionState } from "./collection-types";

export const MAX_EXCHANGES_PER_REQUEST = 50;

type LegacyCollectionState = Omit<WorkspaceCollectionState, "version" | "exchanges"> & {
  version?: number;
  exchanges?: SavedExchange[];
};

export function migrateCollectionState(data: LegacyCollectionState | null): WorkspaceCollectionState {
  if (!data) {
    return { version: 2, specFingerprint: "", nodes: [], requests: [], exchanges: [] };
  }

  if (data.version === 2) {
    return {
      ...data,
      version: 2,
      exchanges: data.exchanges ?? []
    };
  }

  return {
    ...data,
    version: 2,
    exchanges: []
  };
}

export function capExchangesForRequest(
  exchanges: SavedExchange[],
  savedRequestId: string
): SavedExchange[] {
  const forRequest = exchanges.filter((e) => e.savedRequestId === savedRequestId);
  const other = exchanges.filter((e) => e.savedRequestId !== savedRequestId);

  if (forRequest.length <= MAX_EXCHANGES_PER_REQUEST) {
    return exchanges;
  }

  const sorted = [...forRequest].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const kept = sorted.slice(0, MAX_EXCHANGES_PER_REQUEST);
  return [...other, ...kept];
}
