import type { EmbedCoreOptions } from "./types.js";

const DEFAULT_CDN = "https://specora.varcore.dev/embed";

function cdnVersionedBase(options: EmbedCoreOptions): string {
  const base = (options.cdnBase ?? process.env.SPECORA_EMBED_CDN ?? DEFAULT_CDN).replace(/\/$/, "");
  const version = options.version ?? process.env.SPECORA_EMBED_VERSION ?? "latest";
  return version === "latest" ? `${base}/latest` : `${base}/v${version}`;
}

function rewriteEmbedAssetURLs(indexHtml: string, options: EmbedCoreOptions & { mountPath: string }): string {
  const prefix = `${cdnVersionedBase(options)}/`;
  return indexHtml
    .replaceAll('src="/assets/', `src="${prefix}assets/`)
    .replaceAll('href="/assets/', `href="${prefix}assets/`);
}

export function buildBootstrapHtml(
  indexHtml: string,
  options: EmbedCoreOptions & { specUrl: string; mountPath: string }
): string {
  const config: Record<string, unknown> = {
    surface: "embed",
    specUrl: options.specUrl,
    mountPath: options.mountPath,
    publicFilter: options.publicFilter ?? "tag:public",
    includeAll: options.includeAll ?? false,
    downloadJsonUrl: options.downloadJsonUrl ?? options.specUrl,
  };

  if (options.downloadYamlUrl) {
    config.downloadYamlUrl = options.downloadYamlUrl;
  }

  const injection = `<script>window.__SPECORA_EMBED__=${JSON.stringify(config)};</script>`;
  const html = rewriteEmbedAssetURLs(indexHtml, options);

  if (html.includes("</head>")) {
    return html.replace("</head>", `${injection}</head>`);
  }

  return `${injection}${html}`;
}
