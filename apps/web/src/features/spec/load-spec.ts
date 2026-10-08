import { deploymentConfig } from "@/config/deployment";
import { parseSpecText } from "./spec-utils";

export interface LoadedSpec {
  spec: Record<string, unknown>;
  versionLabel: string;
  text: string;
}

const MAX_SPEC_BYTES = 25 * 1024 * 1024;

function describeFetchError(error: unknown, url: string): string {
  if (error instanceof TypeError) {
    return `Could not reach ${url}. The server may be down, or it does not allow cross-origin requests (CORS).`;
  }
  return error instanceof Error ? error.message : "Failed to load spec.";
}

/** Fetch and parse an OpenAPI/Swagger document. Throws an Error with a user-facing message. */
export async function fetchSpecFromUrl(url: string, init?: RequestInit): Promise<LoadedSpec> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    throw new Error(describeFetchError(error, url));
  }
  if (!response.ok) {
    throw new Error(`Unable to fetch spec (HTTP ${response.status}).`);
  }

  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_SPEC_BYTES) {
    throw new Error("Spec is larger than 25 MB.");
  }

  const text = await response.text();
  return parseLoadedText(text);
}

export function parseLoadedText(text: string): LoadedSpec {
  const result = parseSpecText(text);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return { spec: result.spec, versionLabel: result.version.label, text };
}

/**
 * Locate the published-docs record for this page: `?slug=` wins, then a
 * `<slug>.<platform docs domain>` hostname, then the hostname as a custom domain.
 */
export function publishedDocsQuery(location: Pick<Location, "search" | "hostname">): string {
  const slug = new URLSearchParams(location.search).get("slug");
  if (slug) return `slug=${encodeURIComponent(slug)}`;

  const host = location.hostname.toLowerCase();
  const suffix = `.${deploymentConfig.platformDocsDomain.toLowerCase()}`;
  if (host.endsWith(suffix)) {
    return `slug=${encodeURIComponent(host.slice(0, -suffix.length))}`;
  }
  return `host=${encodeURIComponent(deploymentConfig.publicDocsHost ?? host)}`;
}

export async function fetchPublishedSpec(): Promise<LoadedSpec> {
  const apiBase = deploymentConfig.apiBaseUrl.replace(/\/$/, "");
  if (!apiBase) {
    throw new Error("Published docs are unavailable: VITE_API_BASE_URL is not configured.");
  }

  let response: Response;
  try {
    response = await fetch(`${apiBase}/public/docs?${publishedDocsQuery(window.location)}`);
  } catch (error) {
    throw new Error(describeFetchError(error, apiBase));
  }
  if (response.status === 404) {
    throw new Error("These docs are not published.");
  }
  if (!response.ok) {
    throw new Error(`Unable to load published docs (HTTP ${response.status}).`);
  }

  const payload = (await response.json()) as { spec?: Record<string, unknown> };
  if (!payload.spec) {
    throw new Error("Published docs have no specification.");
  }
  return parseLoadedText(JSON.stringify(payload.spec));
}
