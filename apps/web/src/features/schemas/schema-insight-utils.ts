import type { OperationPayloads } from "./operation-payloads";

export function mediaTypeLabel(mediaType?: string): string {
  if (!mediaType) return "Body";
  if (mediaType.includes("json")) return "JSON";
  if (mediaType.includes("xml")) return "XML";
  if (mediaType.includes("form")) return "Form";
  if (mediaType.includes("multipart")) return "Multipart";
  return mediaType.split(";")[0]?.trim() ?? "Body";
}

export function filterInsightParameters(payloads: OperationPayloads): OperationPayloads["parameters"] {
  const hasStructuredBody = payloads.requestBodies.some((b) => b.schema);
  if (!hasStructuredBody) return payloads.parameters;
  return payloads.parameters.filter((p) => p.in !== "body");
}

export async function copyInsightText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
