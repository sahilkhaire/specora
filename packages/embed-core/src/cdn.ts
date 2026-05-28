import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defaultCacheDir, ensureDir, fileExists, readCachedManifest, writeCachedManifest } from "./cache.js";
import type { EmbedCoreOptions, ResolvedEmbedAssets } from "./types.js";

const DEFAULT_CDN = "https://specora.varcore.dev/embed";

export async function fetchManifest(cdnBase: string, version: string): Promise<{
  version: string;
  indexHtmlUrl: string;
  assets: Array<{ path: string; url: string; integrity?: string }>;
}> {
  const base = cdnBase.replace(/\/$/, "");
  const manifestUrl = version === "latest"
    ? `${base}/latest/manifest.json`
    : `${base}/v${version}/manifest.json`;

  const response = await fetch(manifestUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch embed manifest from ${manifestUrl} (HTTP ${response.status})`);
  }

  const manifest = await response.json() as {
    version: string;
    indexHtml: string;
    assets?: Array<{ path: string; integrity?: string }>;
  };

  const versionPrefix = version === "latest" ? `${base}/latest` : `${base}/v${version}`;

  return {
    version: manifest.version,
    indexHtmlUrl: `${versionPrefix}/${manifest.indexHtml}`,
    assets: (manifest.assets ?? []).map((asset) => ({
      path: asset.path,
      url: `${versionPrefix}/${asset.path}`,
      integrity: asset.integrity,
    })),
  };
}

export async function resolveEmbedAssets(options: EmbedCoreOptions): Promise<ResolvedEmbedAssets> {
  const cdnBase = options.cdnBase ?? process.env.SPECORA_EMBED_CDN ?? DEFAULT_CDN;
  const version = options.version ?? process.env.SPECORA_EMBED_VERSION ?? "latest";
  const cacheRoot = options.cacheDir ?? defaultCacheDir();
  const cachePath = join(cacheRoot, version);

  const cached = await readCachedManifest(cachePath);
  if (cached) {
    const indexPath = join(cachePath, cached.indexHtml);
    if (await fileExists(indexPath)) {
      const indexHtml = await readFile(indexPath, "utf8");
      return { version: cached.version, indexHtml, cachePath };
    }
  }

  const remote = await fetchManifest(cdnBase, version);
  await ensureDir(cachePath);

  const indexResponse = await fetch(remote.indexHtmlUrl);
  if (!indexResponse.ok) {
    throw new Error(`Failed to download embed index.html (HTTP ${indexResponse.status})`);
  }

  const indexHtml = await indexResponse.text();
  const indexFileName = remote.indexHtmlUrl.split("/").pop() ?? "index.html";
  await writeFile(join(cachePath, indexFileName), indexHtml, "utf8");

  for (const asset of remote.assets) {
    const response = await fetch(asset.url);
    if (!response.ok) continue;
    const body = await response.text();
    const parts = asset.path.split("/");
    const fileName = parts[parts.length - 1] ?? asset.path;
    await writeFile(join(cachePath, fileName), body, "utf8");
  }

  await writeCachedManifest(cachePath, {
    version: remote.version,
    indexHtml: indexFileName,
    assets: remote.assets.map((a) => ({ path: a.path, integrity: a.integrity })),
  });

  return { version: remote.version, indexHtml, cachePath };
}
