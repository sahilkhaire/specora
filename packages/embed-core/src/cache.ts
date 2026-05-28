import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { EmbedManifest } from "./types.js";

export function defaultCacheDir(): string {
  return join(homedir(), ".cache", "specora", "embed");
}

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function readCachedManifest(cachePath: string): Promise<EmbedManifest | null> {
  const manifestPath = join(cachePath, "manifest.json");
  if (!(await fileExists(manifestPath))) {
    return null;
  }
  const raw = await readFile(manifestPath, "utf8");
  return JSON.parse(raw) as EmbedManifest;
}

export async function writeCachedManifest(cachePath: string, manifest: EmbedManifest): Promise<void> {
  await ensureDir(cachePath);
  await writeFile(join(cachePath, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
}
