import type { SavedRequest } from "./collection-types";

export function parseCurlToRequest(curl: string): Partial<SavedRequest> | null {
  const trimmed = curl.trim();
  if (!trimmed.toLowerCase().startsWith("curl")) {
    return null;
  }

  const methodMatch = trimmed.match(/-X\s+([A-Z]+)/i);
  const method = (methodMatch?.[1] ?? "GET").toUpperCase();

  const urlMatch =
    trimmed.match(/curl\s+(?:-[^\s]+\s+)*['"]?(https?:\/\/[^\s'"]+)/i) ??
    trimmed.match(/['"]?(https?:\/\/[^\s'"]+)['"]?/i);
  const url = urlMatch?.[1] ?? "";

  const headers: Record<string, string> = {};
  const headerRegex = /-H\s+['"]([^:'"]+):\s*([^'"]+)['"]/gi;
  let headerMatch: RegExpExecArray | null;
  while ((headerMatch = headerRegex.exec(trimmed)) !== null) {
    headers[headerMatch[1]!.trim()] = headerMatch[2]!.trim();
  }

  const dataMatch = trimmed.match(/(?:-d|--data(?:-raw)?)\s+['"]([^'"]*)['"]/i);
  const bodyContent = dataMatch?.[1] ?? "";

  return {
    method,
    url,
    headers,
    body: bodyContent ? { mode: "raw", content: bodyContent } : { mode: "none", content: "" }
  };
}
