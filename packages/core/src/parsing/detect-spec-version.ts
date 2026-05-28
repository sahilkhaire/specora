export type SpecVersionKind = "swagger-2.0" | "openapi-3.0" | "openapi-3.1" | "unknown";

export interface DetectedSpecVersion {
  kind: SpecVersionKind;
  /** Raw version string from the document, e.g. "3.0.3" or "2.0" */
  raw: string;
  /** Human-readable label for UI */
  label: string;
}

export function detectSpecVersion(spec: Record<string, unknown>): DetectedSpecVersion {
  const swagger = spec.swagger;
  if (typeof swagger === "string" && swagger.startsWith("2")) {
    return { kind: "swagger-2.0", raw: swagger, label: `Swagger ${swagger}` };
  }

  const openapi = spec.openapi;
  if (typeof openapi === "string") {
    if (openapi.startsWith("3.1")) {
      return { kind: "openapi-3.1", raw: openapi, label: `OpenAPI ${openapi}` };
    }
    if (openapi.startsWith("3.0")) {
      return { kind: "openapi-3.0", raw: openapi, label: `OpenAPI ${openapi}` };
    }
    if (openapi.startsWith("3.")) {
      return { kind: "openapi-3.0", raw: openapi, label: `OpenAPI ${openapi}` };
    }
  }

  return { kind: "unknown", raw: "", label: "Unknown spec version" };
}
