import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/** Throw from a handler to return `{ error }` with the given status. */
export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (message: string) => new ApiError(400, message);
export const unauthorized = (message = "Unauthorized") => new ApiError(401, message);
export const forbidden = (message = "Forbidden") => new ApiError(403, message);
export const notFound = (message = "Not found") => new ApiError(404, message);
export const conflict = (message: string) => new ApiError(409, message);

export function handleError(error: Error, c: Context): Response {
  if (error instanceof ApiError) {
    return c.json({ error: error.message }, error.status);
  }
  if (error instanceof HTTPException) {
    const status = error.status as ContentfulStatusCode;
    return c.json({ error: error.message || "Request failed." }, status);
  }

  console.error(`[api] ${c.req.method} ${c.req.path} failed:`, error);
  return c.json({ error: "Internal server error." }, 500);
}
