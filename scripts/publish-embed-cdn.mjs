#!/usr/bin/env node
/**
 * Build embed surface and write CDN manifest under dist/embed/
 * Upload dist/embed/ to your CDN (e.g. cdn.specora.doc/embed/vX.Y.Z and /latest)
 */
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;
const version = process.env.SPECORA_VERSION ?? "0.1.0";
const outRoot = join(root, "dist", "embed", `v${version}`);
const latestRoot = join(root, "dist", "embed", "latest");

function sha384(content) {
  return `sha384-${createHash("sha384").update(content).digest("base64")}`;
}

async function buildEmbed() {
  execSync("npm run -w @specora/web build:embed", { cwd: root, stdio: "inherit" });
}

async function writeManifest(targetDir, webDist) {
  await mkdir(targetDir, { recursive: true });
  await cp(webDist, targetDir, { recursive: true });

  const indexPath = join(targetDir, "index.html");
  const indexHtml = await readFile(indexPath, "utf8");
  const assets = [];

  for (const file of ["index.html", "assets"]) {
    if (file === "index.html") {
      assets.push({ path: "index.html", integrity: sha384(indexHtml) });
    }
  }

  const manifest = {
    version,
    indexHtml: "index.html",
    assets,
    builtAt: new Date().toISOString(),
  };

  await writeFile(join(targetDir, "manifest.json"), JSON.stringify(manifest, null, 2));
}

async function main() {
  await buildEmbed();
  const webDist = join(root, "apps", "web", "dist-embed");
  await writeManifest(outRoot, webDist);
  await writeManifest(latestRoot, webDist);
  console.log(`Embed CDN artifacts: dist/embed/v${version} and dist/embed/latest`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
