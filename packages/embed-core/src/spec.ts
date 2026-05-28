import { readFile } from "node:fs/promises";
import { watch as fsWatch } from "node:fs";
import YAML from "yaml";

export async function readSpecFile(specPath: string): Promise<Record<string, unknown>> {
  const raw = await readFile(specPath, "utf8");
  const trimmed = raw.trim();
  const parsed = trimmed.startsWith("{") || trimmed.startsWith("[")
    ? JSON.parse(trimmed)
    : YAML.parse(trimmed);

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Spec file must be a JSON or YAML object.");
  }

  return parsed as Record<string, unknown>;
}

export function watchSpecFile(specPath: string, onChange: () => void): () => void {
  const watcher = fsWatch(specPath, () => onChange());
  return () => watcher.close();
}
