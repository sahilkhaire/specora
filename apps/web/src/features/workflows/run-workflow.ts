import {
  applyVariables,
  buildAuthHeaders,
  buildRequestUrl,
  safeParseRecord,
  type AuthConfig,
} from "@/features/tryout/tryout-utils";
import type { WorkflowRunMode, WorkflowStep, WorkflowStepResult } from "./workflow-types";

export interface RunWorkflowConfig {
  serverUrl: string;
  useProxy: boolean;
  proxyUrl: string;
  auth: AuthConfig;
  variables: Record<string, string>;
}

function isSuccessStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

async function executeStep(
  step: WorkflowStep,
  config: RunWorkflowConfig
): Promise<WorkflowStepResult> {
  const start = performance.now();

  const parsedPath = safeParseRecord(step.pathParamsJson);
  if (!parsedPath.ok) {
    return {
      stepId: step.id,
      operationKey: step.operationKey,
      ok: false,
      durationMs: Math.round(performance.now() - start),
      responseBody: "",
      error: `Path params: ${parsedPath.error}`,
    };
  }

  const parsedQuery = safeParseRecord(step.queryParamsJson);
  if (!parsedQuery.ok) {
    return {
      stepId: step.id,
      operationKey: step.operationKey,
      ok: false,
      durationMs: Math.round(performance.now() - start),
      responseBody: "",
      error: `Query params: ${parsedQuery.error}`,
    };
  }

  const parsedHeaders = safeParseRecord(step.headersJson);
  if (!parsedHeaders.ok) {
    return {
      stepId: step.id,
      operationKey: step.operationKey,
      ok: false,
      durationMs: Math.round(performance.now() - start),
      responseBody: "",
      error: `Headers: ${parsedHeaders.error}`,
    };
  }

  if (!config.serverUrl.trim()) {
    return {
      stepId: step.id,
      operationKey: step.operationKey,
      ok: false,
      durationMs: Math.round(performance.now() - start),
      responseBody: "",
      error: "Server URL is required.",
    };
  }

  const vars = config.variables;
  const applyVars = (obj: Record<string, string>): Record<string, string> =>
    Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, applyVariables(v, vars)]));

  const targetUrl = buildRequestUrl({
    baseUrl: applyVariables(config.serverUrl, vars),
    endpointPath: step.path,
    pathParams: applyVars(parsedPath.data),
    queryParams: applyVars(parsedQuery.data),
  });

  const method = step.method;
  const canSendBody = !["GET", "HEAD"].includes(method);
  const body = canSendBody && step.requestBody.trim()
    ? applyVariables(step.requestBody, vars)
    : undefined;
  const mergedHeaders = applyVars({ ...parsedHeaders.data, ...buildAuthHeaders(config.auth) });

  try {
    if (config.useProxy) {
      const proxyResponse = await fetch(config.proxyUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: targetUrl,
          method,
          headers: mergedHeaders,
          body,
        }),
      });

      const payload = await proxyResponse.json() as {
        ok: boolean;
        status: number;
        body: string;
        error?: string;
      };

      if (!proxyResponse.ok || !payload.ok) {
        return {
          stepId: step.id,
          operationKey: step.operationKey,
          ok: false,
          status: payload.status,
          durationMs: Math.round(performance.now() - start),
          responseBody: payload.body ?? "",
          error: payload.error ?? `Proxy failed with HTTP ${proxyResponse.status}`,
        };
      }

      return {
        stepId: step.id,
        operationKey: step.operationKey,
        ok: isSuccessStatus(payload.status),
        status: payload.status,
        durationMs: Math.round(performance.now() - start),
        responseBody: payload.body ?? "",
      };
    }

    const response = await fetch(targetUrl, {
      method,
      headers: mergedHeaders,
      body,
    });
    const responseText = await response.text();

    return {
      stepId: step.id,
      operationKey: step.operationKey,
      ok: isSuccessStatus(response.status),
      status: response.status,
      durationMs: Math.round(performance.now() - start),
      responseBody: responseText,
      error: isSuccessStatus(response.status) ? undefined : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      stepId: step.id,
      operationKey: step.operationKey,
      ok: false,
      durationMs: Math.round(performance.now() - start),
      responseBody: "",
      error: error instanceof Error ? error.message : "Request failed",
    };
  }
}

export async function runWorkflow(
  steps: WorkflowStep[],
  runMode: WorkflowRunMode,
  config: RunWorkflowConfig
): Promise<WorkflowStepResult[]> {
  const results: WorkflowStepResult[] = [];

  for (const step of steps) {
    const result = await executeStep(step, config);
    results.push(result);

    if (runMode === "stop-on-error" && !result.ok) {
      break;
    }
  }

  return results;
}
