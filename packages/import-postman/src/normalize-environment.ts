import type { NormalizedEnvironment } from "./types.js";
import { detectPostmanFile } from "./detect-format.js";

export function importPostmanEnvironment(raw: unknown): NormalizedEnvironment | null {
  const detected = detectPostmanFile(raw);
  if (detected.kind !== "environment" || !raw || typeof raw !== "object") {
    return null;
  }

  const doc = raw as Record<string, unknown>;
  const name = typeof doc.name === "string" ? doc.name : "Imported Environment";
  const variables: Record<string, string> = {};
  const warnings: NormalizedEnvironment["warnings"] = [];

  const values = doc.values;
  if (Array.isArray(values)) {
    for (const entry of values) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as Record<string, unknown>;
      if (row.enabled === false) continue;
      const key = typeof row.key === "string" ? row.key : "";
      if (!key) continue;
      variables[key] = typeof row.value === "string" ? row.value : String(row.value ?? "");
    }
  }

  return { name, variables, warnings };
}
