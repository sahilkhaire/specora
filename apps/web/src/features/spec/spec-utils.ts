import {
  parseSpecTextSync,
  extractOperations as coreExtractOperations,
  detectDefaultServerUrl as coreDetectDefaultServerUrl,
  operationKey as coreOperationKey,
  type OperationItem,
  type OpenApiParameter
} from "@specora/core";

export type { OperationItem, OpenApiParameter };

export type ParseResult =
  | {
      ok: true;
      spec: Record<string, unknown>;
      version: { kind: string; raw: string; label: string };
      warnings: string[];
    }
  | {
      ok: false;
      error: string;
    };

export function parseSpecText(input: string): ParseResult {
  const result = parseSpecTextSync(input);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return {
    ok: true,
    spec: result.spec,
    version: result.version,
    warnings: result.warnings
  };
}

export function extractOperations(spec: Record<string, unknown>): OperationItem[] {
  return coreExtractOperations(spec);
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
  return coreOperationKey(operation);
}

/** Query param used in the browser URL for deep-linking to an operation. */
export const OPERATION_URL_PARAM = "op";

export function getOperationKeyFromLocation(
  location: Pick<Location, "search"> = typeof window !== "undefined" ? window.location : { search: "" }
): string | null {
  const value = new URLSearchParams(location.search).get(OPERATION_URL_PARAM)?.trim();
  return value || null;
}

export function setOperationKeyInLocation(
  key: string,
  options?: { replace?: boolean; location?: Location }
): void {
  if (typeof window === "undefined") {
    return;
  }

  const base = options?.location ?? window.location;
  const url = new URL(base.href);
  url.searchParams.set(OPERATION_URL_PARAM, key);
  window.history[options?.replace ? "replaceState" : "pushState"](window.history.state, "", url);
}

export function clearOperationKeyFromLocation(options?: { replace?: boolean }): void {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  if (!url.searchParams.has(OPERATION_URL_PARAM)) {
    return;
  }

  url.searchParams.delete(OPERATION_URL_PARAM);
  window.history[options?.replace ? "replaceState" : "pushState"](window.history.state, "", url);
}

export function findOperationByKey(
  operations: OperationItem[],
  key: string
): OperationItem | undefined {
  return operations.find((operation) => operation.key === key);
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

export function groupOperationsByTags(
  operations: OperationItem[],
  searchQuery = ""
): TagGroup[] {
  const query = searchQuery.trim().toLowerCase();
  const tagMap = new Map<string, OperationItem[]>();

  operations.forEach((operation) => {
    const tags = operation.tags.length === 0 ? ["Untagged"] : operation.tags;
    const anyTagMatchesQuery =
      query.length > 0 && tags.some((tag) => tag.toLowerCase().includes(query));

    tags.forEach((tag) => {
      if (anyTagMatchesQuery && !tag.toLowerCase().includes(query)) {
        return;
      }
      const tagOps = tagMap.get(tag) ?? [];
      tagOps.push(operation);
      tagMap.set(tag, tagOps);
    });
  });

  return Array.from(tagMap.entries())
    .map(([tag, ops]) => ({ tag, operations: ops }))
    .filter((group) => group.operations.length > 0)
    .sort((a, b) => {
      if (a.tag === "Untagged") return 1;
      if (b.tag === "Untagged") return -1;
      return a.tag.localeCompare(b.tag);
    });
}

export function detectDefaultServerUrl(spec: Record<string, unknown>): string {
  return coreDetectDefaultServerUrl(spec);
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
