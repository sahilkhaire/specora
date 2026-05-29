import type { Environment } from "@/features/environments/env-types";
import type { SavedRequest } from "@/features/collections/collection-types";
import type { AuthConfig, AuthType } from "./tryout-utils";

export type AuthSource = "env" | "custom";

export function resolveAuthSource(request: Pick<SavedRequest, "authSource" | "authType">): AuthSource {
  if (request.authSource === "custom") return "custom";
  if (request.authSource === "env") return "env";
  if (request.authType && request.authType !== "none") return "custom";
  return "env";
}

export function authFromEnvironment(env: Environment | null): AuthConfig {
  if (!env) {
    return { type: "none", value: "", keyName: "X-API-Key" };
  }
  return {
    type: env.auth.type,
    value: env.auth.value,
    keyName: env.auth.keyName
  };
}

export function authForRequest(
  request: Pick<SavedRequest, "authSource" | "authType" | "authValue" | "authKeyName">,
  env: Environment | null
): AuthConfig {
  if (resolveAuthSource(request) === "custom") {
    return {
      type: request.authType ?? "none",
      value: request.authValue ?? "",
      keyName: request.authKeyName ?? "X-API-Key"
    };
  }
  return authFromEnvironment(env);
}

export function authFieldsForUi(
  request: Pick<SavedRequest, "authSource" | "authType" | "authValue" | "authKeyName">,
  env: Environment | null
): { authType: AuthType; authValue: string; authKeyName: string; authSource: AuthSource } {
  const source = resolveAuthSource(request);
  if (source === "custom") {
    return {
      authSource: "custom",
      authType: request.authType ?? "none",
      authValue: request.authValue ?? "",
      authKeyName: request.authKeyName ?? "X-API-Key"
    };
  }
  const envAuth = authFromEnvironment(env);
  return {
    authSource: "env",
    authType: envAuth.type,
    authValue: envAuth.value,
    authKeyName: envAuth.keyName
  };
}
