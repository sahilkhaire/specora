import type { Hono } from "hono";
import { createApp } from "../src/app.js";
import { initDb } from "../src/db/client.js";
import { ensureDefaultInstance } from "../src/routes/admin.js";

export const ORIGIN = "http://localhost:5173";

export async function freshApp(env: Record<string, string | undefined> = {}): Promise<Hono> {
  for (const key of [
    "SPECORA_ADMIN_PASSWORD",
    "PROXY_ENABLED",
    "PROXY_ALLOW_PRIVATE_NETWORKS",
    "COOKIE_SECURE",
    "PUBLISH_AUTO_VERIFY_CUSTOM_DOMAINS",
    "PLATFORM_DOCS_DOMAIN",
    "CORS_ORIGIN",
  ]) {
    delete process.env[key];
  }
  Object.assign(process.env, env);
  initDb(":memory:");
  await ensureDefaultInstance();
  return createApp();
}

/** Minimal cookie-carrying client around `app.request`. */
export class Client {
  private cookies = new Map<string, string>();

  constructor(private readonly app: Hono) {}

  async request(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
    const headers: Record<string, string> = { origin: ORIGIN, ...(init.headers ?? {}) };
    if (init.body !== undefined) headers["content-type"] = "application/json";
    if (this.cookies.size > 0) {
      headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    }
    const response = await this.app.request(path, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : typeof init.body === "string" ? init.body : JSON.stringify(init.body),
    });
    for (const raw of response.headers.getSetCookie()) {
      const [pair] = raw.split(";");
      const [name, ...rest] = pair!.split("=");
      const value = rest.join("=");
      if (!value || /max-age=0/i.test(raw)) this.cookies.delete(name!);
      else this.cookies.set(name!, value);
    }
    const text = await response.text();
    const json = text ? (JSON.parse(text) as Record<string, any>) : {};
    return { status: response.status, json, headers: response.headers };
  }

  setCookie(name: string, value: string): void {
    this.cookies.set(name, value);
  }

  async signup(email: string, password = "correct-horse-battery") {
    return this.request("/auth/signup", { method: "POST", body: { email, password } });
  }
}

export function workspace(id: string, name = `Workspace ${id}`) {
  const now = new Date().toISOString();
  return { id, name, specSource: null, spec: { openapi: "3.0.0", info: { title: name, version: "1" }, paths: {} }, createdAt: now, updatedAt: now };
}
