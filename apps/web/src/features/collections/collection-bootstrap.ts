import { extractOperations, operationKey } from "@specora/core";
import type { OperationItem } from "@/features/spec/spec-utils";
import type { CollectionNode, SavedRequest, WorkspaceCollectionState } from "./collection-types";

function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

export function computeSpecFingerprint(spec: Record<string, unknown>): string {
  const ops = extractOperations(spec);
  return ops.map((o) => `${o.method}:${o.path}:${o.operationId}`).sort().join("|");
}

function emptyState(): WorkspaceCollectionState {
  return { version: 1, specFingerprint: "", nodes: [], requests: [] };
}

export function bootstrapCollectionFromSpec(
  spec: Record<string, unknown>,
  existing: WorkspaceCollectionState | null
): WorkspaceCollectionState {
  const fingerprint = computeSpecFingerprint(spec);
  const operations = extractOperations(spec) as OperationItem[];

  if (!existing) {
    return buildFresh(spec, operations, fingerprint);
  }

  return mergeSpecIntoCollection(existing, operations, fingerprint);
}

function buildFresh(
  _spec: Record<string, unknown>,
  operations: OperationItem[],
  fingerprint: string
): WorkspaceCollectionState {
  const nodes: CollectionNode[] = [];
  const requests: SavedRequest[] = [];
  const tagFolders = new Map<string, string>();

  operations.forEach((op, index) => {
    const tags = op.tags.length > 0 ? op.tags : ["Untagged"];
    const tag = tags[0]!;
    let folderId = tagFolders.get(tag);
    if (!folderId) {
      folderId = uid("folder");
      tagFolders.set(tag, folderId);
      nodes.push({
        id: folderId,
        kind: "folder",
        name: tag,
        parentId: null,
        sortOrder: tagFolders.size
      });
    }

    const requestId = uid("req");
    const key = operationKey(op);
    requests.push({
      id: requestId,
      name: op.summary || `${op.method} ${op.path}`,
      method: op.method,
      url: op.path,
      source: "openapi",
      operationKey: key,
      pathParams: {},
      queryParams: {},
      headers: {},
      body: { mode: "none", content: "" },
      updatedAt: new Date().toISOString()
    });

    nodes.push({
      id: uid("node"),
      kind: "request",
      name: op.summary || `${op.method} ${op.path}`,
      parentId: folderId,
      sortOrder: index,
      requestId
    });
  });

  return { version: 1, specFingerprint: fingerprint, nodes, requests };
}

function mergeSpecIntoCollection(
  existing: WorkspaceCollectionState,
  operations: OperationItem[],
  fingerprint: string
): WorkspaceCollectionState {
  const requests = [...existing.requests];
  const nodes = [...existing.nodes];
  const byOpKey = new Map(
    requests.filter((r) => r.operationKey).map((r) => [r.operationKey!, r] as const)
  );

  for (const op of operations) {
    const key = operationKey(op);
    const prev = byOpKey.get(key);
    if (prev) {
      prev.name = op.summary || prev.name;
      prev.method = op.method;
      if (!prev.url || prev.url === prev.operationKey) {
        prev.url = op.path;
      }
      prev.updatedAt = new Date().toISOString();
      continue;
    }

    const requestId = uid("req");
    requests.push({
      id: requestId,
      name: op.summary || `${op.method} ${op.path}`,
      method: op.method,
      url: op.path,
      source: "openapi",
      operationKey: key,
      pathParams: {},
      queryParams: {},
      headers: {},
      body: { mode: "none", content: "" },
      updatedAt: new Date().toISOString()
    });

    let untaggedFolder = nodes.find((n) => n.kind === "folder" && n.name === "Untagged");
    if (!untaggedFolder) {
      untaggedFolder = {
        id: uid("folder"),
        kind: "folder",
        name: "Untagged",
        parentId: null,
        sortOrder: nodes.length
      };
      nodes.push(untaggedFolder);
    }

    nodes.push({
      id: uid("node"),
      kind: "request",
      name: op.summary || `${op.method} ${op.path}`,
      parentId: untaggedFolder.id,
      sortOrder: nodes.length,
      requestId
    });
  }

  return { ...existing, specFingerprint: fingerprint, nodes, requests };
}

export function createCustomRequest(name = "New Request"): {
  node: CollectionNode;
  request: SavedRequest;
} {
  const requestId = uid("req");
  const request: SavedRequest = {
    id: requestId,
    name,
    method: "GET",
    url: "",
    source: "custom",
    pathParams: {},
    queryParams: {},
    headers: {},
    body: { mode: "none", content: "" },
    updatedAt: new Date().toISOString()
  };
  const node: CollectionNode = {
    id: uid("node"),
    kind: "request",
    name,
    parentId: null,
    sortOrder: 0,
    requestId
  };
  return { node, request };
}

export { emptyState };
