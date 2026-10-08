import type { Context } from "hono";
import { unauthorized } from "../http/errors.js";
import { getUserIdFromRequest } from "./session.js";

export function requireUser(c: Context): string {
  const userId = getUserIdFromRequest(c);
  if (!userId) {
    throw unauthorized();
  }
  return userId;
}
