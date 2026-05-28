import type { DetectedPostmanFile, PostmanCollectionFormat } from "./types.js";

function schemaVersion(doc: Record<string, unknown>): PostmanCollectionFormat {
  const info = doc.info as Record<string, unknown> | undefined;
  const schema = typeof info?.schema === "string" ? info.schema : "";
  if (schema.includes("v2.1")) return "v2.1";
  if (schema.includes("v2.0")) return "v2.0";
  if (Array.isArray(doc.item)) return "v2.1";
  if (Array.isArray(doc.folders) || Array.isArray(doc.requests)) return "v1";
  return "unknown";
}

export function detectPostmanFile(raw: unknown): DetectedPostmanFile {
  if (!raw || typeof raw !== "object") {
    return { kind: "unknown", label: "Invalid JSON" };
  }

  const doc = raw as Record<string, unknown>;

  if (Array.isArray(doc.values)) {
    const scope = doc._postman_variable_scope;
    return {
      kind: "environment",
      label: scope === "globals" ? "Postman Globals" : "Postman Environment"
    };
  }

  if (doc.info || doc.item || doc.folders || doc.requests) {
    const format = schemaVersion(doc);
    return {
      kind: "collection",
      collectionFormat: format,
      label: `Postman Collection ${format === "unknown" ? "" : format}`.trim()
    };
  }

  return { kind: "unknown", label: "Unknown Postman format" };
}
