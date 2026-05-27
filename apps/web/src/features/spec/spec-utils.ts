import YAML from "yaml";

export type ParseResult = {
  ok: true;
  spec: Record<string, unknown>;
} | {
  ok: false;
  error: string;
};

export interface OpenApiParameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
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
  method: string;
  path: string;
  summary: string;
  operationId: string;
  tags: string[];
  description: string;
  parameters: OpenApiParameter[];
  requestBody: unknown;
}

/**
 * Replace Go template placeholders (swagger-go style) with static default values
 * so the resulting string can be parsed as valid JSON.
 */
function processGoTemplate(input: string): string {
  let processed = input;

  // Derive a sensible title/host from any URL present in the template, or fall back.
  const urlMatch = input.match(/https?:\/\/([^/\s"]+)/);
  const domain = urlMatch ? urlMatch[1] : "api.example.com";
  const hostName = domain.split(".")[0] ?? "api";
  const apiTitle = hostName.charAt(0).toUpperCase() + hostName.slice(1) + " API";

  // 1. Replace swagger-go marshal directives with appropriate JSON literals.
  //    .Schemes always defaults to ["https"]; any other marshal produces [].
  processed = processed.replace(/\{\{\s*marshal\s+\.Schemes\s*\}\}/g, '["https"]');
  processed = processed.replace(/\{\{\s*marshal\s+\.\w+\s*\}\}/g, "[]");

  // 2. Replace quoted template expressions  "{{...}}"  with sensible JSON strings.
  //    We match the surrounding double-quotes explicitly to avoid double-quoting.
  processed = processed.replace(/"(\{\{[^}]+\}\})"/g, (_match: string, inner: string) => {
    const fieldMatch = inner.match(/\.\s*(\w+)/);
    const field = fieldMatch ? fieldMatch[1].toLowerCase() : "";
    if (field === "title" || field === "name") return `"${apiTitle}"`;
    if (field === "host") return `"${domain}"`;
    if (field === "basepath") return '"/"';
    if (field === "version") return '"1.0.0"';
    if (field === "description") return '""';
    return '""';
  });

  // 3. Any remaining unquoted {{...}} blocks (e.g. block-level directives) → null.
  processed = processed.replace(/\{\{[^}]*\}\}/g, "null");

  return processed;
}

export function parseSpecText(input: string): ParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: "Spec input is empty." };
  }

  // Detect HTML responses
  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
    return {
      ok: false,
      error: "The response is HTML, not an OpenAPI spec. This usually means the URL redirected to a web page or returned an error page. Check the URL and ensure it points directly to the API spec file."
    };
  }

  // Auto-process Go templates
  let processedInput = trimmed;
  if (trimmed.includes("{{") && trimmed.includes("}}")) {
    processedInput = processGoTemplate(trimmed);
  }

  try {
    const parsed = processedInput.startsWith("{") || processedInput.startsWith("[")
      ? JSON.parse(processedInput)
      : YAML.parse(processedInput);

    if (!parsed || typeof parsed !== "object") {
      return { ok: false, error: "Parsed spec is not a valid object." };
    }

    const maybeOpenapi = parsed as Record<string, unknown>;
    if (!maybeOpenapi.openapi && !maybeOpenapi.swagger) {
      return { ok: false, error: "Missing openapi/swagger version field. The file doesn't appear to be a valid OpenAPI/Swagger specification." };
    }

    return { ok: true, spec: maybeOpenapi };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown parse error";
    
    // Provide more context for JSON parse errors
    if (message.includes("JSON") || message.includes("position")) {
      return {
        ok: false,
        error: `JSON parse error: ${message}. Please ensure the URL returns valid JSON or YAML content.`
      };
    }
    
    return {
      ok: false,
      error: `Parse error: ${message}`
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
          parameters: Array.isArray(op.parameters)
            ? (op.parameters as Record<string, unknown>[])
              .filter((p) => p !== null && typeof p === "object" && typeof p.name === "string")
              .map((p): OpenApiParameter => ({
                name: p.name as string,
                in: (["path", "query", "header", "cookie"].includes(p.in as string) ? p.in : "query") as OpenApiParameter["in"],
                required: typeof p.required === "boolean" ? p.required : false,
                description: typeof p.description === "string" ? p.description : undefined,
                schema: (p.schema as OpenApiParameter["schema"]) ?? undefined,
                example: p.example
              }))
            : [],
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
