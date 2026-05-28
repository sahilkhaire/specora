import { deploymentConfig } from "@/config/deployment";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function baseUrl(): string {
  const url = deploymentConfig.apiBaseUrl.replace(/\/$/, "");
  if (!url) {
    throw new ApiError("API base URL is not configured.", 0);
  }
  return url;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: text };
    }
  }

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : `Request failed with HTTP ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return body as T;
}
