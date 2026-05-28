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
        const normalizedMethod = method.toUpperCase();
        const operationId = typeof op.operationId === "string" ? op.operationId : "";
        const tags = Array.isArray(op.tags) ? op.tags.filter((tag): tag is string => typeof tag === "string") : [];
        const summary = typeof op.summary === "string" ? op.summary : "No summary";
        const description = typeof op.description === "string" ? op.description : "";
        const key = `${normalizedMethod}:${path}:${operationId}`;
        const searchTextLower = `${path} ${summary} ${tags.join(" ")}`.toLowerCase();

        return {
          key,
          method: normalizedMethod,
          path,
          summary,
          operationId,
          tags,
          description,
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
          requestBody: op.requestBody,
          searchTextLower
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
    const searchMatch = !query || operation.searchTextLower.includes(query);

    return methodMatch && searchMatch;
  });
}

export function operationKey(operation: Pick<OperationItem, "method" | "path" | "operationId">): string {
  return `${operation.method}:${operation.path}:${operation.operationId}`;
}

export interface TagGroup {
  tag: string;
  operations: OperationItem[];
}

export interface UsedSchemaDetail {
  name: string;
  type: string;
  description: string;
  properties: string[];
  propertyMeta: Array<{
    name: string;
    type: string;
    required: boolean;
  }>;
  source: "component" | "inline";
}

export function groupOperationsByTags(operations: OperationItem[]): TagGroup[] {
  const tagMap = new Map<string, OperationItem[]>();

  operations.forEach((operation) => {
    if (operation.tags.length === 0) {
      // Operations without tags go into "Untagged" group
      const untaggedOps = tagMap.get("Untagged") ?? [];
      untaggedOps.push(operation);
      tagMap.set("Untagged", untaggedOps);
    } else {
      // Add operation to each of its tags
      operation.tags.forEach((tag) => {
        const tagOps = tagMap.get(tag) ?? [];
        tagOps.push(operation);
        tagMap.set(tag, tagOps);
      });
    }
  });

  // Convert map to array and sort by tag name
  return Array.from(tagMap.entries())
    .map(([tag, ops]) => ({ tag, operations: ops }))
    .sort((a, b) => {
      // "Untagged" goes to the end
      if (a.tag === "Untagged") return 1;
      if (b.tag === "Untagged") return -1;
      return a.tag.localeCompare(b.tag);
    });
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

function collectRefsDeep(node: unknown, refs: Set<string>): void {
  if (!node || typeof node !== "object") {
    return;
  }

  if (Array.isArray(node)) {
    node.forEach((item) => collectRefsDeep(item, refs));
    return;
  }

  const record = node as Record<string, unknown>;
  const maybeRef = record.$ref;
  if (typeof maybeRef === "string" && maybeRef.trim()) {
    refs.add(maybeRef.trim());
  }

  Object.values(record).forEach((value) => collectRefsDeep(value, refs));
}

function resolveLocalRef(spec: Record<string, unknown>, ref: string): unknown {
  if (!ref.startsWith("#/")) {
    return null;
  }

  const segments = ref
    .slice(2)
    .split("/")
    .map((segment) => decodeURIComponent(segment).replace(/~1/g, "/").replace(/~0/g, "~"));

  let current: unknown = spec;
  for (const segment of segments) {
    if (!current || typeof current !== "object") {
      return null;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function decodeRefToken(token: string): string {
  return decodeURIComponent(token).replace(/~1/g, "/").replace(/~0/g, "~");
}

function extractSchemaNameFromRef(ref: string): string | null {
  const componentMatch = ref.match(/^#\/components\/schemas\/([^/]+)$/);
  if (componentMatch && componentMatch[1]) {
    return decodeRefToken(componentMatch[1]);
  }

  const definitionsMatch = ref.match(/^#\/definitions\/([^/]+)$/);
  if (definitionsMatch && definitionsMatch[1]) {
    return decodeRefToken(definitionsMatch[1]);
  }

  return null;
}

function getSchemaFieldType(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "unknown";
  }

  const record = value as Record<string, unknown>;
  if (typeof record.$ref === "string") {
    const parts = record.$ref.split("/");
    return parts[parts.length - 1] ?? "ref";
  }

  if (typeof record.type === "string") {
    return record.type;
  }

  if (Array.isArray(record.oneOf)) return "oneOf";
  if (Array.isArray(record.anyOf)) return "anyOf";
  if (Array.isArray(record.allOf)) return "allOf";

  return "unknown";
}

function buildSchemaDetail(
  name: string,
  raw: unknown,
  source: "component" | "inline"
): UsedSchemaDetail {
  const schema = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  const type = typeof schema?.type === "string" ? schema.type : "schema";
  const description = typeof schema?.description === "string" ? schema.description : "";
  const required = schema?.required;
  const requiredSet = new Set(
    Array.isArray(required)
      ? required.filter((item): item is string => typeof item === "string")
      : []
  );
  const properties =
    schema?.properties && typeof schema.properties === "object" && !Array.isArray(schema.properties)
      ? Object.keys(schema.properties as Record<string, unknown>)
      : [];
  const propertyMeta = properties.map((propertyName) => {
    const propSchema = (schema?.properties as Record<string, unknown> | undefined)?.[propertyName];
    return {
      name: propertyName,
      type: getSchemaFieldType(propSchema),
      required: requiredSet.has(propertyName),
    };
  });

  return {
    name,
    type,
    description,
    properties,
    propertyMeta,
    source,
  };
}

function collectInlineSchemasForOperation(
  opItem: Record<string, unknown>,
  pathItem: Record<string, unknown>
): Array<{ label: string; schema: Record<string, unknown> }> {
  const inlineSchemas: Array<{ label: string; schema: Record<string, unknown> }> = [];

  const collectSchemaCandidate = (label: string, value: unknown) => {
    if (!value || typeof value !== "object") {
      return;
    }
    const schema = value as Record<string, unknown>;
    if (typeof schema.$ref === "string") {
      return;
    }
    inlineSchemas.push({ label, schema });
  };

  const collectFromParameters = (parameters: unknown, scope: "Operation" | "Path") => {
    if (!Array.isArray(parameters)) {
      return;
    }
    parameters.forEach((param, index) => {
      if (!param || typeof param !== "object") {
        return;
      }
      const entry = param as Record<string, unknown>;
      const name = typeof entry.name === "string" ? entry.name : `param-${index + 1}`;
      collectSchemaCandidate(`${scope} Parameter: ${name}`, entry.schema);

      // Swagger 2 body/form parameters can carry inline schemas under "items".
      if (entry.in === "formData") {
        collectSchemaCandidate(`${scope} Form Field: ${name}`, entry.items);
      }
    });
  };

  const collectFromContent = (labelPrefix: string, content: unknown) => {
    if (!content || typeof content !== "object") {
      return;
    }
    Object.entries(content as Record<string, unknown>).forEach(([mediaType, mediaTypeValue]) => {
      if (!mediaTypeValue || typeof mediaTypeValue !== "object") {
        return;
      }
      const mediaRecord = mediaTypeValue as Record<string, unknown>;
      collectSchemaCandidate(`${labelPrefix} (${mediaType})`, mediaRecord.schema);
    });
  };

  collectFromParameters(pathItem.parameters, "Path");
  collectFromParameters(opItem.parameters, "Operation");

  const requestBody = opItem.requestBody;
  if (requestBody && typeof requestBody === "object") {
    collectFromContent("Request Body", (requestBody as Record<string, unknown>).content);
  }

  const responses = opItem.responses;
  if (responses && typeof responses === "object") {
    Object.entries(responses as Record<string, unknown>).forEach(([status, response]) => {
      if (!response || typeof response !== "object") {
        return;
      }
      const responseRecord = response as Record<string, unknown>;
      collectFromContent(`Response ${status}`, responseRecord.content);
      collectSchemaCandidate(`Response ${status}`, responseRecord.schema);
    });
  }

  return inlineSchemas;
}

export function getUsedSchemasForOperation(
  spec: Record<string, unknown>,
  operation: Pick<OperationItem, "path" | "method">
): string[] {
  const paths = (spec.paths as Record<string, unknown> | undefined) ?? {};
  const pathItem = paths[operation.path] as Record<string, unknown> | undefined;
  if (!pathItem || typeof pathItem !== "object") {
    return [];
  }

  const methodKey = operation.method.toLowerCase();
  const opItem = pathItem[methodKey] as Record<string, unknown> | undefined;
  if (!opItem || typeof opItem !== "object") {
    return [];
  }

  const initialNodes: unknown[] = [opItem];
  if (Array.isArray(pathItem.parameters)) {
    initialNodes.push(pathItem.parameters);
  }

  const allRefs = new Set<string>();
  initialNodes.forEach((node) => collectRefsDeep(node, allRefs));

  // Follow local refs to include transitive schema usage.
  const queue = Array.from(allRefs);
  const visited = new Set<string>();
  while (queue.length > 0) {
    const ref = queue.shift() as string;
    if (visited.has(ref)) {
      continue;
    }
    visited.add(ref);

    const resolved = resolveLocalRef(spec, ref);
    if (!resolved) {
      continue;
    }

    const nestedRefs = new Set<string>();
    collectRefsDeep(resolved, nestedRefs);
    nestedRefs.forEach((nestedRef) => {
      if (!allRefs.has(nestedRef)) {
        allRefs.add(nestedRef);
        queue.push(nestedRef);
      }
    });
  }

  const schemas = new Set<string>();
  allRefs.forEach((ref) => {
    const schemaName = extractSchemaNameFromRef(ref);
    if (!schemaName) {
      return;
    }
    schemas.add(schemaName);
  });

  return Array.from(schemas).sort((a, b) => a.localeCompare(b));
}

export function filterPublicOperations(
  operations: OperationItem[],
  spec: Record<string, unknown>
): OperationItem[] {
  const paths = (spec.paths as Record<string, unknown> | undefined) ?? {};

  return operations.filter((operation) => {
    if (operation.tags.some((tag) => tag.toLowerCase() === "public")) {
      return true;
    }

    const pathItem = paths[operation.path] as Record<string, unknown> | undefined;
    const opItem = pathItem?.[operation.method.toLowerCase()] as Record<string, unknown> | undefined;
    if (!opItem) {
      return false;
    }

    if (opItem["x-specora-visibility"] === "public") {
      return true;
    }

    if (!("security" in opItem)) {
      return true;
    }

    const security = opItem.security;
    return Array.isArray(security) && security.length === 0;
  });
}

export function getUsedSchemaDetailsForOperation(
  spec: Record<string, unknown>,
  operation: Pick<OperationItem, "path" | "method">
): UsedSchemaDetail[] {
  const paths = (spec.paths as Record<string, unknown> | undefined) ?? {};
  const pathItem = paths[operation.path] as Record<string, unknown> | undefined;
  if (!pathItem || typeof pathItem !== "object") {
    return [];
  }

  const methodKey = operation.method.toLowerCase();
  const opItem = pathItem[methodKey] as Record<string, unknown> | undefined;
  if (!opItem || typeof opItem !== "object") {
    return [];
  }

  const components = (spec.components as Record<string, unknown> | undefined) ?? {};
  const componentSchemas = (components.schemas as Record<string, unknown> | undefined) ?? {};
  const definitionSchemas = (spec.definitions as Record<string, unknown> | undefined) ?? {};

  const componentDetails = getUsedSchemasForOperation(spec, operation).map((name) => {
    const resolvedSchema = componentSchemas[name] ?? definitionSchemas[name];
    return buildSchemaDetail(name, resolvedSchema, "component");
  });

  const inlineDetails = collectInlineSchemasForOperation(opItem, pathItem).map(({ label, schema }) =>
    buildSchemaDetail(label, schema, "inline")
  );

  return [...componentDetails, ...inlineDetails];
}
