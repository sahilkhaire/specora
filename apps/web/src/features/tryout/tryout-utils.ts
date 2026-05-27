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
