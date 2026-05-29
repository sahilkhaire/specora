import { describe, expect, it } from "vitest";
import { authFieldsForUi, authForRequest, resolveAuthSource } from "./auth-source";
import type { SavedRequest } from "@/features/collections/collection-types";
import type { Environment } from "@/features/environments/env-types";

const env: Environment = {
  id: "env_1",
  name: "Staging",
  baseUrl: "https://api.example.com",
  auth: { type: "bearer", value: "env-token", keyName: "X-API-Key" },
  variables: {}
};

describe("auth-source", () => {
  it("defaults to env auth when request has no custom auth", () => {
    const request = { authType: "none" } as SavedRequest;
    expect(resolveAuthSource(request)).toBe("env");
    expect(authForRequest(request, env)).toEqual({
      type: "bearer",
      value: "env-token",
      keyName: "X-API-Key"
    });
  });

  it("uses custom auth when authSource is custom", () => {
    const request = {
      authSource: "custom",
      authType: "api-key",
      authValue: "secret",
      authKeyName: "X-Custom"
    } as SavedRequest;
    expect(authForRequest(request, env)).toEqual({
      type: "api-key",
      value: "secret",
      keyName: "X-Custom"
    });
  });

  it("shows env auth fields in UI when inheriting environment", () => {
    expect(authFieldsForUi({ authSource: "env" }, env)).toEqual({
      authSource: "env",
      authType: "bearer",
      authValue: "env-token",
      authKeyName: "X-API-Key"
    });
  });
});
