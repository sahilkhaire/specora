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

/** JSON that is safe to place inside an inline <script> (no `</script>` or HTML comment breakouts). */
export function serializeForInlineScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
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

  const injection = `<script>window.__SPECORA_EMBED__=${serializeForInlineScript(config)};</script>`;
  const html = rewriteEmbedAssetURLs(indexHtml, options);

  if (html.includes("</head>")) {
    return html.replace("</head>", `${injection}</head>`);
  }

  return `${injection}${html}`;
}
