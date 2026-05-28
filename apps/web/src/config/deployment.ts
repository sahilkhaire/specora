export type DeploymentMode = "saas" | "enterprise" | "embed";
export type AppSurface = "full" | "docs" | "embed";

export interface DeploymentConfig {
  mode: DeploymentMode;
  surface: AppSurface;
  apiBaseUrl: string;
  enableSaasAuth: boolean;
  embedCdnBase: string;
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

  return {
    mode,
    surface,
    apiBaseUrl: envString("VITE_API_BASE_URL", ""),
    enableSaasAuth: envBool("VITE_ENABLE_SAAS_AUTH", mode === "saas" && surface === "full"),
    embedCdnBase: envString("VITE_EMBED_CDN_BASE", "https://cdn.specora.doc/embed"),
    publicDocsHost: envString("VITE_PUBLIC_DOCS_HOST", "") || undefined,
  };
}

export const deploymentConfig = getDeploymentConfig();

export function isEmbedSurface(): boolean {
  return deploymentConfig.surface === "embed" || deploymentConfig.surface === "docs";
}

export function isFullAppSurface(): boolean {
  return deploymentConfig.surface === "full";
}
