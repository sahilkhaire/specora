import type { SpecSummary } from "../types/spec-types.js";

export function summarizeSpec(spec: Record<string, unknown>): SpecSummary {
  const info = (spec.info as Record<string, unknown> | undefined) ?? {};
  const paths = (spec.paths as Record<string, unknown> | undefined) ?? {};

  const tags = new Set<string>();
  Object.values(paths).forEach((pathItem) => {
    if (pathItem && typeof pathItem === "object") {
      Object.values(pathItem as Record<string, unknown>).forEach((operation) => {
        const tagList = (operation as { tags?: unknown[] })?.tags;
        if (Array.isArray(tagList)) {
          tagList.forEach((tag) => {
            if (typeof tag === "string") {
              tags.add(tag);
            }
          });
        }
      });
    }
  });

  return {
    title: String(info.title ?? "Untitled API"),
    version: String(info.version ?? "unknown"),
    endpointCount: Object.keys(paths).length,
    tags: Array.from(tags).sort()
  };
}
