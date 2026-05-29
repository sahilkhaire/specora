export type DeploymentMode = "saas" | "enterprise" | "embed";
export type AppSurface = "full" | "docs" | "embed";

export interface DeploymentConfig {
  mode: DeploymentMode;
  surface: AppSurface;
  apiBaseUrl: string;
  /** POST endpoint that forwards try-out requests server-side (avoids browser CORS). */
  tryoutProxyUrl: string;
  /** When true, try-out sends via tryoutProxyUrl instead of calling APIs directly from the browser. */
  tryoutUseProxy: boolean;
  enableSaasAuth: boolean;
  embedCdnBase: string;
  /** Parent domain for published docs subdomains, e.g. `acme.docs.varcore.dev`. */
  platformDocsDomain: string;
  publicDocsHost?: string;
}

function envString(key: string, fallback: string): string {
  const value = import.meta.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function envBool(key: string, fallback: boolean): boolean {
  const raw = import.meta.env[key];
  if (raw === "true") return true;
  if (raw === "false") return false;
  return fallback;
}

export function getDeploymentConfig(): DeploymentConfig {
  const modeRaw = envString("VITE_DEPLOYMENT_MODE", "saas");
  const mode: DeploymentMode =
    modeRaw === "enterprise" || modeRaw === "embed" ? modeRaw : "saas";

  const surfaceRaw = envString("VITE_APP_SURFACE", "full");
  const surface: AppSurface =
    surfaceRaw === "docs" || surfaceRaw === "embed" ? surfaceRaw : "full";

  const apiBaseUrl = envString("VITE_API_BASE_URL", "");
  const tryoutProxyUrl = envString(
    "VITE_TRYOUT_PROXY_URL",
    "http://localhost:8787/proxy"
  );
  const tryoutUseProxy = envBool("VITE_TRYOUT_USE_PROXY", false);

  return {
    mode,
    surface,
    apiBaseUrl,
    tryoutProxyUrl,
    tryoutUseProxy,
    enableSaasAuth: envBool("VITE_ENABLE_SAAS_AUTH", false),
    embedCdnBase: envString(
      "VITE_EMBED_CDN_BASE",
      "https://specora.varcore.dev/embed"
    ),
    platformDocsDomain: envString("VITE_PLATFORM_DOCS_DOMAIN", "docs.varcore.dev"),
    publicDocsHost: envString("VITE_PUBLIC_DOCS_HOST", "") || undefined,
  };
}

/** Read-only docs URL for a workspace slug on the platform subdomain. */
export function platformPublishUrl(slug: string): string {
  const host = `${slug}.${deploymentConfig.platformDocsDomain}`;
  return `https://${host}`;
}

export const deploymentConfig = getDeploymentConfig();

export function isEmbedSurface(): boolean {
  return deploymentConfig.surface === "embed" || deploymentConfig.surface === "docs";
}

export function isFullAppSurface(): boolean {
  return deploymentConfig.surface === "full";
}

/** SaaS or enterprise full app — user imports specs into workspaces (not embed/docs). */
export function isHostedApp(): boolean {
  return (
    isFullAppSurface() &&
    (deploymentConfig.mode === "saas" || deploymentConfig.mode === "enterprise")
  );
}

export interface SpecoraEmbedConfig {
  surface?: string;
  specUrl?: string;
  mountPath?: string;
  publicFilter?: string;
  includeAll?: boolean;
  /** Backend URL for canonical JSON spec download (SDK only). */
  downloadJsonUrl?: string;
  /** Backend URL for canonical YAML spec download (SDK only). */
  downloadYamlUrl?: string;
}

declare global {
  interface Window {
    __SPECORA_EMBED__?: SpecoraEmbedConfig;
  }
}

export function getSpecoraEmbedConfig(): SpecoraEmbedConfig | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window.__SPECORA_EMBED__;
}

/** True when opened via backend SDK or embed/docs surface. */
export function isSdkEmbeddedContext(): boolean {
  if (isEmbedSurface()) {
    return true;
  }
  return Boolean(getSpecoraEmbedConfig());
}

/** Show workspace dropdown / create / rename / delete. */
export function showWorkspaceManagement(): boolean {
  return isFullAppSurface() && !isSdkEmbeddedContext();
}

/** Import or replace OpenAPI spec from the UI (hosted app only). */
export function showImportSpec(): boolean {
  return isFullAppSurface() && !isSdkEmbeddedContext();
}
