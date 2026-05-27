import type { OpenApiParameter } from "@/features/spec/spec-utils";

export interface RequestConfig {
  baseUrl: string;
  endpointPath: string;
  pathParams: Record<string, string>;
  queryParams: Record<string, string>;
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
