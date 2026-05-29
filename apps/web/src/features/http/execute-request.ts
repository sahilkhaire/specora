import type { Environment } from "@/features/environments/env-types";
import type { SavedRequest } from "@/features/collections/collection-types";
import { fetchViaTryoutProxy } from "@/features/http/proxy-client";
import { authForRequest } from "@/features/tryout/auth-source";
import {
  applyVariables,
  buildAuthHeaders,
  resolveRequestUrl,
  mapTryoutSendError,
  parseRecordJson,
  type AuthConfig
} from "@/features/tryout/tryout-utils";
import { parseParamRowsToRecord } from "@/features/tryout/param-rows";

export interface ExecuteRequestOptions {
  request: SavedRequest;
  serverUrl: string;
  environment: Environment | null;
  useProxy: boolean;
  proxyUrl: string;
  authOverride?: AuthConfig;
}

export interface ExecuteRequestResult {
  ok: boolean;
  status?: number;
  durationMs: number;
  responseBody: string;
  responseHeaders: Record<string, string>;
  error?: string;
}

export async function executeRequest(options: ExecuteRequestOptions): Promise<ExecuteRequestResult> {
  const { request, serverUrl, environment, useProxy, proxyUrl, authOverride } = options;
  const started = performance.now();

  const pathParams = request.pathParams;
  const queryParams = request.queryParams;
  const extraHeaders = request.headers;

  const envAuth = authOverride ?? authForRequest(request, environment);

  const baseUrl = applyVariables(serverUrl || environment?.baseUrl || "", environment?.variables ?? {});
  const urlPath = applyVariables(request.url, environment?.variables ?? {});
  const resolvedPathParams = Object.fromEntries(
    Object.entries(pathParams).map(([key, value]) => [
      key,
      applyVariables(value, environment?.variables ?? {})
    ])
  );
  const resolvedQueryParams = Object.fromEntries(
    Object.entries(queryParams).map(([key, value]) => [
      key,
      applyVariables(value, environment?.variables ?? {})
    ])
  );
  const fullUrl = resolveRequestUrl({
    serverUrl: baseUrl,
    endpointPath: urlPath,
    pathParams: resolvedPathParams,
    queryParams: resolvedQueryParams
  });

  const headers: Record<string, string> = {
    ...buildAuthHeaders(envAuth),
    ...Object.fromEntries(
      Object.entries(extraHeaders).map(([k, v]) => [k, applyVariables(v, environment?.variables ?? {})])
    )
  };

  const body =
    request.body.mode !== "none" && request.body.content
      ? applyVariables(request.body.content, environment?.variables ?? {})
      : undefined;

  if (body && !headers["Content-Type"] && !headers["content-type"]) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const durationMs = () => Math.round(performance.now() - started);

    if (useProxy) {
      const payload = await fetchViaTryoutProxy(proxyUrl, {
        url: fullUrl,
        method: request.method,
        headers,
        body: body ?? null
      });

      return {
        ok: payload.status >= 200 && payload.status < 300,
        status: payload.status,
        durationMs: durationMs(),
        responseBody: payload.body,
        responseHeaders: payload.headers
      };
    }

    const response = await fetch(fullUrl, {
      method: request.method,
      headers,
      body: body && request.method !== "GET" && request.method !== "HEAD" ? body : undefined
    });

    const text = await response.text();
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      ok: response.ok,
      status: response.status,
      durationMs: durationMs(),
      responseBody: text,
      responseHeaders
    };
  } catch (error) {
    return {
      ok: false,
      durationMs: Math.round(performance.now() - started),
      responseBody: "",
      responseHeaders: {},
      error: mapTryoutSendError(error, useProxy)
    };
  }
}

export function savedRequestFromTryoutState(input: {
  operationKey?: string;
  name: string;
  method: string;
  url: string;
  pathParamsInput: string;
  queryParamsInput: string;
  headersInput: string;
  requestBody: string;
  source: SavedRequest["source"];
}): SavedRequest {
  return {
    id: "",
    name: input.name,
    method: input.method,
    url: input.url,
    source: input.source,
    operationKey: input.operationKey,
    pathParams: parseParamRowsToRecord(input.pathParamsInput),
    queryParams: parseParamRowsToRecord(input.queryParamsInput),
    headers: parseRecordJson(input.headersInput),
    body: input.requestBody
      ? { mode: "json", content: input.requestBody }
      : { mode: "none", content: "" },
    updatedAt: new Date().toISOString()
  };
}
