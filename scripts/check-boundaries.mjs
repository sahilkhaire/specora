#!/usr/bin/env node
/**
 * Architecture boundary checker.
 *
 * Enforces three layers of import discipline:
 *
 *   1. packages/core  must NOT import from packages/cli or apps/web
 *   2. packages/cli   must NOT import from apps/web
 *   3. Within packages/cli: the utils/ layer must NOT import from commands/ or server/
 *
 * Run:  node scripts/check-boundaries.mjs
 * Exit: 0 on success, 1 on any violation.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

// ─── helpers ────────────────────────────────────────────────────────────────

/** Recursively collect all .ts / .tsx files under `dir`. */
function collectSourceFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectSourceFiles(full));
    } else if (/\.(tsx?|mts)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

/** Extract all static import/re-export specifiers from a source file. */
function extractImports(filePath) {
  const src = readFileSync(filePath, "utf8");
  const specifiers = [];
  // Covers: import … from "…",  export … from "…",  import("…")
  const re = /(?:^|\s)(?:import|export)\s[^'"]*from\s+['"]([^'"]+)['"]/gm;
  let m;
  while ((m = re.exec(src)) !== null) specifiers.push(m[1]);
  // Dynamic import(...)
  const dyn = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = dyn.exec(src)) !== null) specifiers.push(m[1]);
  return specifiers;
}

/**
 * Resolve an import specifier relative to the file that contains it.
 * Returns the absolute path if it resolves to a local file, otherwise null.
 */
function resolveLocal(specifier, fromFile) {
  if (!specifier.startsWith(".")) return null;
  const base = join(fromFile, "..", specifier);
  return base;
}

// ─── boundary rules ─────────────────────────────────────────────────────────

const rules = [
  {
    label: "packages/core must not import from packages/cli",
    sourceGlob: resolve(ROOT, "packages/core/src"),
    forbiddenSegment: `packages${"/"}cli`,
  },
  {
    label: "packages/core must not import from apps/web",
    sourceGlob: resolve(ROOT, "packages/core/src"),
    forbiddenSegment: `apps${"/"}web`,
  },
  {
    label: "packages/cli must not import from apps/web",
    sourceGlob: resolve(ROOT, "packages/cli/src"),
    forbiddenSegment: `apps${"/"}web`,
  },
  {
    label: "packages/cli/utils must not import from packages/cli/commands",
    sourceGlob: resolve(ROOT, "packages/cli/src/utils"),
    forbiddenSegment: `cli${"/"}src${"/"}commands`,
  },
  {
    label: "packages/cli/utils must not import from packages/cli/server",
    sourceGlob: resolve(ROOT, "packages/cli/src/utils"),
    forbiddenSegment: `cli${"/"}src${"/"}server`,
  },
];

// ─── check ──────────────────────────────────────────────────────────────────

let violations = 0;

for (const rule of rules) {
  const files = collectSourceFiles(rule.sourceGlob);
  for (const file of files) {
    const imports = extractImports(file);
    for (const specifier of imports) {
      // Resolve relative imports to absolute paths so we can check the segment
      let resolved = specifier;
      if (specifier.startsWith(".")) {
        resolved = resolveLocal(specifier, file) ?? specifier;
      }
      if (resolved.includes(rule.forbiddenSegment)) {
        console.error(
          `[boundary] VIOLATION: ${rule.label}\n` +
          `  file:   ${relative(ROOT, file)}\n` +
          `  import: "${specifier}"\n`
        );
        violations++;
      }
    }
  }
}

if (violations === 0) {
  console.log(`[boundary] All ${rules.length} rules passed — no cross-layer violations found.`);
  process.exit(0);
} else {
  console.error(`[boundary] ${violations} violation(s) found. Fix them before merging.`);
  process.exit(1);
}
