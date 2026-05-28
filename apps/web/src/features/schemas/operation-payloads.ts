import type { OperationItem } from "@/features/spec/spec-utils";

export interface PayloadSlot {
  id: string;
  label: string;
  mediaType?: string;
  statusCode?: string;
  required: boolean;
  description: string;
  schema: Record<string, unknown> | null;
}

export interface OperationPayloads {
  requestBodies: PayloadSlot[];
  responses: PayloadSlot[];
  parameters: Array<{
    name: string;
    in: string;
    required: boolean;
    type: string;
    description: string;
  }>;
}

function asSchema(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.$ref === "string" || record.type || record.properties || record.items) {
    return record;
  }
  return record;
}

export function getOperationPayloads(
  spec: Record<string, unknown>,
  operation: Pick<OperationItem, "path" | "method" | "parameters" | "requestBody">
): OperationPayloads {
  const paths = (spec.paths as Record<string, unknown> | undefined) ?? {};
  const pathItem = paths[operation.path] as Record<string, unknown> | undefined;
  const methodKey = operation.method.toLowerCase();
  const opItem =
    (pathItem?.[methodKey] as Record<string, unknown> | undefined) ??
    ({ parameters: operation.parameters, requestBody: operation.requestBody } as Record<string, unknown>);

  const parameters: OperationPayloads["parameters"] = [];

  const collectParams = (params: unknown, scope: string) => {
    if (!Array.isArray(params)) return;
    params.forEach((p, index) => {
      if (!p || typeof p !== "object") return;
      const row = p as Record<string, unknown>;
      const name = typeof row.name === "string" ? row.name : `param-${index + 1}`;
      const location = typeof row.in === "string" ? row.in : scope;
      const schema = row.schema ?? row;
      parameters.push({
        name,
        in: location,
        required: Boolean(row.required),
        type:
          typeof (schema as Record<string, unknown>)?.type === "string"
            ? String((schema as Record<string, unknown>).type)
            : row.type
              ? String(row.type)
              : "string",
        description: typeof row.description === "string" ? row.description : ""
      });
    });
  };

  collectParams(pathItem?.parameters, "path");
  collectParams(opItem.parameters, "query");

  const requestBodies: PayloadSlot[] = [];
  const requestBody = opItem.requestBody;
  if (requestBody && typeof requestBody === "object") {
    const rb = requestBody as Record<string, unknown>;
    const content = rb.content as Record<string, unknown> | undefined;
    if (content) {
      Object.entries(content).forEach(([mediaType, mediaValue]) => {
        if (!mediaValue || typeof mediaValue !== "object") return;
        const schema = asSchema((mediaValue as Record<string, unknown>).schema);
        requestBodies.push({
          id: `req-${mediaType}`,
          label: "Request body",
          mediaType,
          required: Boolean(rb.required),
          description: typeof rb.description === "string" ? rb.description : "",
          schema
        });
      });
    }
  }

  // Swagger 2 body parameter
  if (Array.isArray(opItem.parameters)) {
    for (const p of opItem.parameters as Record<string, unknown>[]) {
      if (p?.in === "body") {
        requestBodies.push({
          id: "req-body",
          label: "Request body",
          mediaType: "application/json",
          required: Boolean(p.required),
          description: typeof p.description === "string" ? p.description : "",
          schema: asSchema(p.schema)
        });
      }
    }
  }

  const responses: PayloadSlot[] = [];
  const responsesObj = opItem.responses as Record<string, unknown> | undefined;
  if (responsesObj) {
    Object.entries(responsesObj).forEach(([status, response]) => {
      if (!response || typeof response !== "object") return;
      const res = response as Record<string, unknown>;
      const desc = typeof res.description === "string" ? res.description : "";

      const content = res.content as Record<string, unknown> | undefined;
      if (content) {
        Object.entries(content).forEach(([mediaType, mediaValue]) => {
          if (!mediaValue || typeof mediaValue !== "object") return;
          const schema = asSchema((mediaValue as Record<string, unknown>).schema);
          responses.push({
            id: `res-${status}-${mediaType}`,
            label: `Response ${status}`,
            mediaType,
            statusCode: status,
            required: false,
            description: desc,
            schema
          });
        });
      } else if (res.schema) {
        responses.push({
          id: `res-${status}`,
          label: `Response ${status}`,
          mediaType: "application/json",
          statusCode: status,
          required: false,
          description: desc,
          schema: asSchema(res.schema)
        });
      }
    });
  }

  return { requestBodies, responses, parameters };
}

export function getPrimaryRequestBodySchema(payloads: OperationPayloads): Record<string, unknown> | null {
  const json =
    payloads.requestBodies.find((b) => b.mediaType?.includes("json")) ?? payloads.requestBodies[0];
  return json?.schema ?? null;
}
