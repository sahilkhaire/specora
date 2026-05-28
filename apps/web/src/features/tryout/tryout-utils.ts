import type { OpenApiParameter } from "@/features/spec/spec-utils";

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

export function buildRequestUrl(config: RequestConfig): string {
  const cleanedBase = config.baseUrl.trim().replace(/\/$/, "");
  const withPathParams = config.endpointPath.replace(/\{([^}]+)\}/g, (_full, key: string) => {
    const replacement = config.pathParams[key];
    return encodeURIComponent(replacement ?? `{${key}}`);
  });

  const full = `${cleanedBase}${withPathParams}`;
  const query = new URLSearchParams();

  Object.entries(config.queryParams).forEach(([key, value]) => {
    if (value !== "") {
      query.set(key, value);
    }
  });

  const queryString = query.toString();
  return queryString ? `${full}?${queryString}` : full;
}

// ─── Parameter scaffolding ──────────────────────────────────────────────────

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
    return "CORS blocked the request. Next step: enable CORS on the API or use the local proxy mode.";
  }

  if (
    normalized.includes("failed to fetch")
    || normalized.includes("networkerror")
    || normalized.includes("network error")
    || normalized.includes("load failed")
  ) {
    if (useProxy) {
      return "Could not reach the local proxy. Next step: start `specora proxy` and confirm the proxy URL.";
    }
    return "Network request failed (often CORS or connectivity). Next step: check API reachability or enable proxy mode.";
  }

  if (useProxy && normalized.includes("proxy")) {
    return "Proxy request failed. Next step: verify proxy is running and the target endpoint is reachable.";
  }

  return `Request failed: ${rawMessage}`;
}
