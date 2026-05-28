import type { AuthType } from "@/features/tryout/tryout-utils";

export type NodeKind = "folder" | "request";
export type RequestSource = "openapi" | "custom" | "postman";

export interface CollectionNode {
  id: string;
  kind: NodeKind;
  name: string;
  parentId: string | null;
  sortOrder: number;
  /** Set when kind=request */
  requestId?: string;
}

export interface SavedRequestBody {
  mode: "none" | "raw" | "json" | "form" | "multipart";
  content: string;
}

export interface SavedRequest {
  id: string;
  name: string;
  method: string;
  url: string;
  source: RequestSource;
  operationKey?: string;
  pathParams: Record<string, string>;
  queryParams: Record<string, string>;
  headers: Record<string, string>;
  body: SavedRequestBody;
  authType?: AuthType;
  authValue?: string;
  authKeyName?: string;
  description?: string;
  updatedAt: string;
}

export interface WorkspaceCollectionState {
  version: 1;
  specFingerprint: string;
  nodes: CollectionNode[];
  requests: SavedRequest[];
}

export interface RequestHistoryEntry {
  id: string;
  savedRequestId?: string;
  operationKey?: string;
  method: string;
  url: string;
  status?: number;
  durationMs: number;
  responsePreview: string;
  createdAt: string;
}
