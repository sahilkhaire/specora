export interface EmbedManifest {
  version: string;
  indexHtml: string;
  assets: Array<{
    path: string;
    integrity?: string;
  }>;
}

export interface EmbedCoreOptions {
  specPath: string;
  mountPath?: string;
  cdnBase?: string;
  version?: string;
  cacheDir?: string;
  publicFilter?: "tag:public" | "extension" | "no-security" | "all";
  includeAll?: boolean;
  watch?: boolean;
  /** Override canonical JSON download URL injected into embed config. */
  downloadJsonUrl?: string;
  /** Override canonical YAML download URL injected into embed config. */
  downloadYamlUrl?: string;
}

export interface ResolvedEmbedAssets {
  version: string;
  indexHtml: string;
  cachePath: string;
}
