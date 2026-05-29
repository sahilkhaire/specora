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

export interface SavedExchangeRequestSnapshot {
  method: string;
  url: string;
  pathParams: Record<string, string>;
  queryParams: Record<string, string>;
  headers: Record<string, string>;
  body: SavedRequestBody;
  authType?: AuthType;
  authValue?: string;
  authKeyName?: string;
}

export interface SavedExchangeResponse {
  status?: number;
  durationMs: number;
  headers: Record<string, string>;
  body: string;
}

export interface SavedExchange {
  id: string;
  savedRequestId: string;
  name: string;
  requestSnapshot: SavedExchangeRequestSnapshot;
  response: SavedExchangeResponse;
  createdAt: string;
}

export interface WorkspaceCollectionState {
  version: 2;
  specFingerprint: string;
  nodes: CollectionNode[];
  requests: SavedRequest[];
  exchanges: SavedExchange[];
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
