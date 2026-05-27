import type { OutputFormat } from "../types/cli-types.js";

export function normalizeOutputFormat(value: string): OutputFormat {
  return value === "json" ? "json" : "text";
}

export function printFailure(
  prefix: string,
  message: string,
  hint: string | undefined,
  format: OutputFormat
): void {
  if (format === "json") {
    console.log(JSON.stringify({ ok: false, error: { prefix, message, hint } }, null, 2));
    return;
  }

  console.error(`${prefix}: ${message}`);
  if (hint) {
    console.error(`Hint: ${hint}`);
  }
}
