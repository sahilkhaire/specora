/**
 * Return `value` only if it is an http(s) or mailto URL. Spec documents are
 * untrusted input; `javascript:` and `data:` links from them must never reach an href.
 */
export function safeExternalHref(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim(), typeof window !== "undefined" ? window.location.href : "https://localhost/");
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
