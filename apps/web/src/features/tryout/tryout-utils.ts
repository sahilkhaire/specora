import type { OpenApiParameter, OperationItem } from "@/features/spec/spec-utils";

export interface RequestConfig {
  baseUrl: string;
  endpointPath: string;
  pathParams: Record<string, string>;
  queryParams: Record<string, string>;
}

export function parseRecordJson(value: string): Record<string, string> {
  const parsed = safeParseRecord(value);
  return parsed.ok ? parsed.data : {};
}

export function safeParseRecord(value: string): {
  ok: true;
  data: Record<string, string>;
} | {
  ok: false;
  error: string;
} {
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: true, data: {} };
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "Expected a JSON object." };
    }

    const output: Record<string, string> = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([key, val]) => {
      output[key] = String(val);
    });

    return { ok: true, data: output };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid JSON"
    };
  }
}

export function stripUrlQuery(path: string): string {
  const queryIndex = path.indexOf("?");
  return queryIndex === -1 ? path : path.slice(0, queryIndex);
}

export function substitutePathParams(path: string, pathParams: Record<string, string>): string {
  return path.replace(/\{([^}]+)\}/g, (_full, key: string) => {
    const replacement = pathParams[key];
    return encodeURIComponent(replacement ?? `{${key}}`);
  });
}

export function pathWithColonParams(path: string): string {
  return stripUrlQuery(path).replace(/\{([^}]+)\}/g, (_full, key: string) => `:${key}`);
}

export function pathFromColonParams(path: string): string {
  return stripUrlQuery(path).replace(/:([A-Za-z_][\w-]*)/g, (_full, key: string) => `{${key}}`);
}

function appendQueryParams(baseUrl: string, queryParams: Record<string, string>): string {
  const query = new URLSearchParams();
  Object.entries(queryParams).forEach(([key, value]) => {
    query.set(key, value);
  });
  const queryString = query.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

/** Preview URL: path placeholders as :paramName, query params as literal values. */
export function resolveDisplayRequestUrl(input: {
  serverUrl: string;
  endpointPath: string;
  queryParams?: Record<string, string>;
}): string {
  const queryParams = input.queryParams ?? {};
  const endpointPath = pathWithColonParams(input.endpointPath.trim());
  const serverUrl = input.serverUrl.trim();

  if (endpointPath.startsWith("http://") || endpointPath.startsWith("https://")) {
    try {
      const url = new URL(endpointPath);
      return appendQueryParams(url.toString(), queryParams);
    } catch {
      return appendQueryParams(endpointPath, queryParams);
    }
  }

  if (!serverUrl) {
    return appendQueryParams(endpointPath, queryParams);
  }

  const cleanedBase = serverUrl.replace(/\/$/, "");
  const path = endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`;
  return appendQueryParams(`${cleanedBase}${path}`, queryParams);
}

export function buildRequestUrl(config: RequestConfig): string {
  const cleanedBase = config.baseUrl.trim().replace(/\/$/, "");
  const withPathParams = substitutePathParams(stripUrlQuery(config.endpointPath), config.pathParams);
  const full = `${cleanedBase}${withPathParams}`;
  const query = new URLSearchParams();

  Object.entries(config.queryParams).forEach(([key, value]) => {
    query.set(key, value);
  });

  const queryString = query.toString();
  return queryString ? `${full}?${queryString}` : full;
}

export function resolveRequestUrl(input: {
  serverUrl: string;
  endpointPath: string;
  pathParams?: Record<string, string>;
  queryParams?: Record<string, string>;
}): string {
  const pathParams = input.pathParams ?? {};
  const queryParams = input.queryParams ?? {};
  const endpointPath = stripUrlQuery(input.endpointPath.trim());
  const serverUrl = input.serverUrl.trim();

  if (endpointPath.startsWith("http://") || endpointPath.startsWith("https://")) {
    try {
      const url = new URL(substitutePathParams(endpointPath, pathParams));
      for (const [key, value] of Object.entries(queryParams)) {
        url.searchParams.set(key, value);
      }
      return url.toString();
    } catch {
      return buildRequestUrl({
        baseUrl: "",
        endpointPath,
        pathParams,
        queryParams
      }).replace(/^\?/, "");
    }
  }

  if (!serverUrl) {
    const pathOnly = substitutePathParams(endpointPath, pathParams);
    const query = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
      query.set(key, value);
    });
    const queryString = query.toString();
    return queryString ? `${pathOnly}?${queryString}` : pathOnly;
  }

  return buildRequestUrl({
    baseUrl: serverUrl,
    endpointPath,
    pathParams,
    queryParams
  });
}

// ─── Parameter scaffolding ──────────────────────────────────────────────────

export function extractPathParamNames(path: string): string[] {
  const names: string[] = [];
  for (const match of path.matchAll(/\{([^}]+)\}/g)) {
    names.push(match[1]);
  }
  return names;
}

function defaultValueForParam(param: OpenApiParameter): string {
  if (param.example !== undefined) return String(param.example);
  if (param.schema?.example !== undefined) return String(param.schema.example);
  if (param.schema?.default !== undefined) return String(param.schema.default);
  if (param.schema?.enum?.length) return String(param.schema.enum[0]);
  const type = param.schema?.type ?? "string";
  if (type === "integer" || type === "number") return "0";
  if (type === "boolean") return "false";
  return "";
}

export function scaffoldFromParameters(parameters: OpenApiParameter[]): {
  pathParams: Record<string, string>;
  queryParams: Record<string, string>;
  headers: Record<string, string>;
} {
  const pathParams: Record<string, string> = {};
  const queryParams: Record<string, string> = {};
  const headers: Record<string, string> = {};

  for (const param of parameters) {
    const value = defaultValueForParam(param);
    if (param.in === "path") pathParams[param.name] = value;
    else if (param.in === "query") queryParams[param.name] = value;
    else if (param.in === "header") headers[param.name] = value;
    // cookie params are not surfaced in the UI
  }

  return { pathParams, queryParams, headers };
}

export function scaffoldFromOperation(
  operation: Pick<OperationItem, "path" | "parameters">
): {
  pathParams: Record<string, string>;
  queryParams: Record<string, string>;
  headers: Record<string, string>;
} {
  const result = scaffoldFromParameters(operation.parameters);

  for (const name of extractPathParamNames(operation.path)) {
    if (!(name in result.pathParams)) {
      result.pathParams[name] = "";
    }
  }

  return result;
}

export function mergeParamRecord(
  current: Record<string, string>,
  scaffold: Record<string, string>
): Record<string, string> {
  const merged: Record<string, string> = {};

  for (const key of Object.keys(scaffold)) {
    merged[key] = key in current ? current[key] : scaffold[key];
  }

  for (const [key, value] of Object.entries(current)) {
    if (!(key in merged)) {
      merged[key] = value;
    }
  }

  return merged;
}

// ─── Authentication ─────────────────────────────────────────────────────────

export type AuthType = "none" | "bearer" | "basic" | "api-key";

export interface AuthConfig {
  type: AuthType;
  /** Token, base64 credentials, or API key value */
  value: string;
  /** Header name used for api-key auth (default: X-API-Key) */
  keyName: string;
}

export function buildAuthHeaders(auth: AuthConfig): Record<string, string> {
  if (auth.type === "bearer" && auth.value.trim()) {
    return { Authorization: `Bearer ${auth.value.trim()}` };
  }
  if (auth.type === "basic" && auth.value.trim()) {
    return { Authorization: `Basic ${auth.value.trim()}` };
  }
  if (auth.type === "api-key" && auth.value.trim()) {
    const headerName = auth.keyName.trim() || "X-API-Key";
    return { [headerName]: auth.value.trim() };
  }
  return {};
}

// ─── Variable interpolation ─────────────────────────────────────────────────

/**
 * Replace every `{{varName}}` token in `input` with the matching entry from
 * `variables`. Unknown tokens are left unchanged so users can spot typos.
 */
export function applyVariables(
  input: string,
  variables: Record<string, string>
): string {
  return input.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match
  );
}

export function buildCurlCommand(options: {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}): string {
  const escape = (value: string) => value.replace(/'/g, "'\\''");
  const lines = [`curl -X ${options.method} '${escape(options.url)}'`];
  Object.entries(options.headers).forEach(([key, value]) => {
    lines.push(`  -H '${escape(key)}: ${escape(value)}'`);
  });
  if (options.body?.trim()) {
    lines.push(`  -d '${escape(options.body)}'`);
  }
  return lines.join(" \\\n");
}

export function methodBadgeClass(method: string): string {
  if (method === "GET") return "method-badge method-get";
  if (method === "POST") return "method-badge method-post";
  if (method === "PUT" || method === "PATCH") return "method-badge method-put";
  if (method === "DELETE") return "method-badge method-delete";
  return "method-badge method-default";
}

export function statusBadgeClass(status: string): string {
  const code = Number(status);
  if (code >= 200 && code < 300) return "status-badge status-2xx";
  if (code >= 300 && code < 400) return "status-badge status-3xx";
  if (code >= 400 && code < 500) return "status-badge status-4xx";
  if (code >= 500) return "status-badge status-5xx";
  return "status-badge";
}

export function mapTryoutSendError(error: unknown, useProxy: boolean): string {
  const rawMessage = error instanceof Error ? error.message : String(error ?? "Failed to send request");
  const normalized = rawMessage.toLowerCase();

  if (normalized.includes("abort") || normalized.includes("timeout")) {
    return "Request timed out. Next step: retry, verify the server URL, and check API/proxy responsiveness.";
  }

  if (
    normalized.includes("401")
    || normalized.includes("403")
    || normalized.includes("unauthorized")
    || normalized.includes("forbidden")
  ) {
    return "Authentication failed (401/403). Next step: update auth credentials or token, then retry.";
  }

  if (normalized.includes("cors")) {
    return useProxy
      ? "CORS blocked the proxy request. Next step: confirm the local proxy is running (`npx specora proxy --port 8787`) and the proxy URL is correct."
      : "CORS blocked the request. Next step: enable CORS on the target API, or enable Proxy and run `npx specora proxy --port 8787` locally.";
  }

  if (
    normalized.includes("failed to fetch")
    || normalized.includes("networkerror")
    || normalized.includes("network error")
    || normalized.includes("load failed")
  ) {
    if (useProxy) {
      return "Could not reach the local proxy. Next step: start `npx specora proxy --port 8787` and confirm the proxy URL.";
    }
    return "Network request failed (often CORS or connectivity). Next step: check API reachability or enable local proxy mode (`npx specora proxy --port 8787`).";
  }

  if (useProxy && normalized.includes("proxy")) {
    return "Proxy request failed. Next step: verify proxy is running and the target endpoint is reachable.";
  }

  return `Request failed: ${rawMessage}`;
}

export function prettyResponseBody(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return raw;
  }
}
