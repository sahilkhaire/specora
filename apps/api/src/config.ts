/**
 * Runtime configuration, read from the environment on each call so tests can
 * override values per case. Keep all `process.env` access for the API here.
 */

function envString(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

function envBool(key: string, fallback: boolean): boolean {
  const value = envString(key)?.toLowerCase();
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return fallback;
}

function envInt(key: string, fallback: number): number {
  const parsed = Number.parseInt(envString(key) ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function databasePath(): string {
  const url = envString("DATABASE_URL") ?? "file:./specora.db";
  return url.startsWith("file:") ? url.slice("file:".length) : url;
}

export function corsOrigins(): string[] {
  const raw = envString("CORS_ORIGIN");
  if (!raw) {
    return ["https://specora.varcore.dev", "http://localhost:5173"];
  }
  return raw
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

/** Session cookies require HTTPS in production unless explicitly disabled (e.g. plain-HTTP intranet). */
export function cookieSecure(): boolean {
  return envBool("COOKIE_SECURE", isProduction());
}

/** Optional cookie domain so a session set by api.example.com is visible to example.com subdomains. */
export function cookieDomain(): string | undefined {
  return envString("COOKIE_DOMAIN");
}

/** The try-out proxy is an outbound HTTP relay; it must be opted into explicitly. */
export function proxyEnabled(): boolean {
  return envBool("PROXY_ENABLED", false);
}

export function proxyAllowPrivateNetworks(): boolean {
  return envBool("PROXY_ALLOW_PRIVATE_NETWORKS", false);
}

export function proxyTimeoutMs(): number {
  return envInt("SPECORA_PROXY_TIMEOUT_MS", 30_000);
}

export function proxyMaxResponseBytes(): number {
  return envInt("SPECORA_PROXY_MAX_RESPONSE_BYTES", 10 * 1024 * 1024);
}

/** Maximum accepted request body. Specs are stored inline, so this needs headroom. */
export function maxBodyBytes(): number {
  return envInt("SPECORA_MAX_BODY_BYTES", 20 * 1024 * 1024);
}

/** Admin routes are disabled unless an admin password is configured. There is no default. */
export function adminPassword(): string | undefined {
  return envString("SPECORA_ADMIN_PASSWORD");
}

/** Parent domain for published docs, e.g. `acme.docs.varcore.dev`. */
export function platformDocsDomain(): string {
  return (
    envString("PLATFORM_DOCS_DOMAIN") ??
    envString("INSTANCE_BASE_DOMAIN") ??
    "docs.varcore.dev"
  ).toLowerCase();
}

/**
 * Custom domains are only served once verified. Single-tenant self-hosted
 * deployments, where every user is trusted, can skip verification.
 */
export function autoVerifyCustomDomains(): boolean {
  return envBool("PUBLISH_AUTO_VERIFY_CUSTOM_DOMAINS", false);
}

/** Honour X-Forwarded-For for client IPs (rate limiting). Enable only behind a trusted proxy. */
export function trustProxy(): boolean {
  return envBool("TRUST_PROXY", false);
}

export function port(): number {
  return envInt("PORT", 8788);
}
