import type { EmbedCoreOptions } from "./types.js";

export function buildBootstrapHtml(
  indexHtml: string,
  options: EmbedCoreOptions & { specUrl: string; mountPath: string }
): string {
  const config = {
    surface: "embed",
    specUrl: options.specUrl,
    mountPath: options.mountPath,
    publicFilter: options.publicFilter ?? "tag:public",
    includeAll: options.includeAll ?? false,
  };

  const injection = `<script>window.__SPECORA_EMBED__=${JSON.stringify(config)};</script>`;

  if (indexHtml.includes("</head>")) {
    return indexHtml.replace("</head>", `${injection}</head>`);
  }

  return `${injection}${indexHtml}`;
}
