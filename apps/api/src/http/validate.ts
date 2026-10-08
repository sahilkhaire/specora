import type { Context } from "hono";
import { badRequest } from "./errors.js";

export type JsonRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parse a JSON object body, turning malformed input into a 400 instead of a 500. */
export async function readJsonObject(c: Context): Promise<JsonRecord> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw badRequest("Request body must be valid JSON.");
  }
  if (!isRecord(body)) {
    throw badRequest("Request body must be a JSON object.");
  }
  return body;
}

export function optionalString(body: JsonRecord, key: string, maxLength = 2048): string | undefined {
  const value = body[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw badRequest(`Field '${key}' must be a string.`);
  }
  if (value.length > maxLength) {
    throw badRequest(`Field '${key}' must be at most ${maxLength} characters.`);
  }
  return value;
}

export function requiredString(body: JsonRecord, key: string, maxLength = 2048): string {
  const value = optionalString(body, key, maxLength)?.trim();
  if (!value) {
    throw badRequest(`Field '${key}' is required.`);
  }
  return value;
}

export function optionalArray(body: JsonRecord, key: string, maxItems: number): unknown[] {
  const value = body[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw badRequest(`Field '${key}' must be an array.`);
  }
  if (value.length > maxItems) {
    throw badRequest(`Field '${key}' must contain at most ${maxItems} items.`);
  }
  return value;
}

export function optionalBoolean(body: JsonRecord, key: string): boolean | undefined {
  const value = body[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "boolean") {
    throw badRequest(`Field '${key}' must be a boolean.`);
  }
  return value;
}

/** Stored JSON columns may predate validation; never let a bad row 500 a read. */
export function parseStoredJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_PATTERN.test(value);
}

/** Client-generated entity ids: UUIDs or short slugs, nothing path- or SQL-shaped. */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function isValidId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}
