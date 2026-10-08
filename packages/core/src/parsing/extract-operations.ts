import type { OperationItem, OpenApiParameter } from "./operation-types.js";

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "options", "head"]);

function mapParameter(p: Record<string, unknown>): OpenApiParameter {
  return {
    name: p.name as string,
    in: (["path", "query", "header", "cookie", "body", "formData"].includes(p.in as string)
      ? p.in
      : "query") as OpenApiParameter["in"],
    required: typeof p.required === "boolean" ? p.required : false,
    description: typeof p.description === "string" ? p.description : undefined,
    schema: (p.schema as OpenApiParameter["schema"]) ?? undefined,
    example: p.example
  };
}

function collectPathLevelParameters(pathItem: Record<string, unknown>): OpenApiParameter[] {
  if (!Array.isArray(pathItem.parameters)) {
    return [];
  }
  return (pathItem.parameters as Record<string, unknown>[])
    .filter((p) => p !== null && typeof p === "object" && typeof p.name === "string")
    .map(mapParameter);
}

export function extractOperations(spec: Record<string, unknown>): OperationItem[] {
  const paths = (spec.paths as Record<string, unknown> | undefined) ?? {};

  return Object.entries(paths).flatMap(([path, pathItem]) => {
    if (!pathItem || typeof pathItem !== "object") {
      return [];
    }

    const pathRecord = pathItem as Record<string, unknown>;
    const pathLevelParams = collectPathLevelParameters(pathRecord);

    return Object.entries(pathRecord)
      .filter(([method]) => HTTP_METHODS.has(method.toLowerCase()))
      .map(([method, operation]) => {
        const op = operation as Record<string, unknown>;
        const normalizedMethod = method.toUpperCase();
        const operationId = typeof op.operationId === "string" ? op.operationId : "";
        const tags = Array.isArray(op.tags)
          ? op.tags.filter((tag): tag is string => typeof tag === "string")
          : [];
        const summary = typeof op.summary === "string" ? op.summary : "No summary";
        const description = typeof op.description === "string" ? op.description : "";
        const key = `${normalizedMethod}:${path}:${operationId}`;
        const searchTextLower = `${path} ${summary} ${tags.join(" ")} ${normalizedMethod}`.toLowerCase();

        const opParams = Array.isArray(op.parameters)
          ? (op.parameters as Record<string, unknown>[])
              .filter((p) => p !== null && typeof p === "object" && typeof p.name === "string")
              .map(mapParameter)
          : [];

        const parameters = [...pathLevelParams, ...opParams];

        return {
          key,
          method: normalizedMethod,
          path,
          summary,
          operationId,
          tags,
          description,
          parameters,
          requestBody: op.requestBody ?? op.consumes,
          searchTextLower
        };
      });
  });
}

export function operationKey(operation: Pick<OperationItem, "method" | "path" | "operationId">): string {
  return `${operation.method}:${operation.path}:${operation.operationId}`;
}

export function detectDefaultServerUrl(spec: Record<string, unknown>): string {
  const servers = Array.isArray(spec.servers) ? spec.servers : [];
  const first = servers.find(
    (server): server is { url: string; variables?: unknown } =>
      Boolean(server) && typeof server === "object" && typeof (server as { url?: unknown }).url === "string"
  );
  if (first) {
    // Fill `{name}` server variables with their declared defaults.
    const variables =
      first.variables && typeof first.variables === "object" ? (first.variables as Record<string, unknown>) : {};
    return first.url.replace(/\{([^}]+)\}/g, (match, name: string) => {
      const definition = variables[name] as { default?: unknown } | null | undefined;
      return definition && definition.default !== undefined ? String(definition.default) : match;
    });
  }

  if (typeof spec.host === "string") {
    const scheme =
      Array.isArray(spec.schemes) && typeof spec.schemes[0] === "string" ? spec.schemes[0] : "https";
    const basePath = typeof spec.basePath === "string" ? spec.basePath : "";
    return `${scheme}://${spec.host}${basePath}`;
  }

  return "";
}
