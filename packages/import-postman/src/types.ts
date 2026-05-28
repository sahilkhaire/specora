export type PostmanCollectionFormat = "v1" | "v2.0" | "v2.1" | "unknown";
export type PostmanImportKind = "collection" | "environment" | "unknown";

export interface ImportWarning {
  code: string;
  message: string;
}

export interface NormalizedRequest {
  id: string;
  name: string;
  method: string;
  url: string;
  pathParams: Record<string, string>;
  queryParams: Record<string, string>;
  headers: Record<string, string>;
  body: { mode: "none" | "raw" | "json" | "form" | "multipart"; content: string };
  auth?: {
    type: "none" | "bearer" | "basic" | "api-key";
    value: string;
    keyName: string;
  };
  description?: string;
}

export interface NormalizedFolder {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
}

export interface NormalizedCollection {
  format: PostmanCollectionFormat;
  name: string;
  folders: NormalizedFolder[];
  requests: Array<NormalizedRequest & { folderId: string | null; sortOrder: number }>;
  warnings: ImportWarning[];
}

export interface NormalizedEnvironment {
  name: string;
  variables: Record<string, string>;
  warnings: ImportWarning[];
}

export interface DetectedPostmanFile {
  kind: PostmanImportKind;
  collectionFormat?: PostmanCollectionFormat;
  label: string;
}
