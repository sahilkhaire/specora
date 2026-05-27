import YAML from "yaml";

export type ParseResult = {
  ok: true;
  spec: Record<string, unknown>;
} | {
  ok: false;
  error: string;
};

export interface OperationItem {
  method: string;
  path: string;
  summary: string;
  operationId: string;
  tags: string[];
  description: string;
  parameters: unknown[];
  requestBody: unknown;
}

export function parseSpecText(input: string): ParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: "Spec input is empty." };
  }

  try {
    const parsed = trimmed.startsWith("{") || trimmed.startsWith("[")
      ? JSON.parse(trimmed)
      : YAML.parse(trimmed);

    if (!parsed || typeof parsed !== "object") {
      return { ok: false, error: "Parsed spec is not a valid object." };
    }

    const maybeOpenapi = parsed as Record<string, unknown>;
    if (!maybeOpenapi.openapi && !maybeOpenapi.swagger) {
      return { ok: false, error: "Missing openapi/swagger version field." };
    }

    return { ok: true, spec: maybeOpenapi };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown parse error"
    };
  }
}

export function extractOperations(spec: Record<string, unknown>): OperationItem[] {
  const paths = (spec.paths as Record<string, unknown> | undefined) ?? {};
  const methods = new Set(["get", "post", "put", "patch", "delete", "options", "head"]);

  return Object.entries(paths).flatMap(([path, pathItem]) => {
    if (!pathItem || typeof pathItem !== "object") {
      return [];
    }

    return Object.entries(pathItem as Record<string, unknown>)
      .filter(([method]) => methods.has(method.toLowerCase()))
      .map(([method, operation]) => {
        const op = operation as Record<string, unknown>;
        const tags = Array.isArray(op.tags) ? op.tags.filter((tag): tag is string => typeof tag === "string") : [];

        return {
          method: method.toUpperCase(),
          path,
          summary: typeof op.summary === "string" ? op.summary : "No summary",
          operationId: typeof op.operationId === "string" ? op.operationId : "",
          tags,
          description: typeof op.description === "string" ? op.description : "",
          parameters: Array.isArray(op.parameters) ? op.parameters : [],
          requestBody: op.requestBody
        };
      });
  });
}

export function filterOperations(
  operations: OperationItem[],
  methodFilter: string,
  searchTerm: string
): OperationItem[] {
  const query = searchTerm.trim().toLowerCase();

  return operations.filter((operation) => {
    const methodMatch = methodFilter === "ALL" || operation.method === methodFilter;
    const searchMatch = !query
      || operation.path.toLowerCase().includes(query)
      || operation.summary.toLowerCase().includes(query)
      || operation.tags.some((tag) => tag.toLowerCase().includes(query));

    return methodMatch && searchMatch;
  });
}

export function operationKey(operation: Pick<OperationItem, "method" | "path" | "operationId">): string {
  return `${operation.method}:${operation.path}:${operation.operationId}`;
}

export function detectDefaultServerUrl(spec: Record<string, unknown>): string {
  const servers = spec.servers;
  if (Array.isArray(servers) && servers.length > 0) {
    const first = servers[0] as { url?: unknown };
    if (typeof first.url === "string") {
      return first.url;
    }
  }

  return "";
}
