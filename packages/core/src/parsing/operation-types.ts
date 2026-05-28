export interface OpenApiParameter {
  name: string;
  in: "path" | "query" | "header" | "cookie" | "body" | "formData";
  required?: boolean;
  description?: string;
  schema?: {
    type?: string;
    format?: string;
    example?: unknown;
    default?: unknown;
    enum?: unknown[];
  };
  example?: unknown;
}

export interface OperationItem {
  key: string;
  method: string;
  path: string;
  summary: string;
  operationId: string;
  tags: string[];
  description: string;
  parameters: OpenApiParameter[];
  requestBody: unknown;
  searchTextLower: string;
}
