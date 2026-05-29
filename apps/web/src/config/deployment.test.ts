import { afterEach, describe, expect, it } from "vitest";
import {
  getSpecoraEmbedConfig,
  isSdkEmbeddedContext,
  showImportSpec,
  showTryOutPanel,
  showWorkspaceManagement,
} from "./deployment";

describe("deployment embed helpers", () => {
  afterEach(() => {
    delete window.__SPECORA_EMBED__;
  });

  it("returns undefined embed config when not injected", () => {
    expect(getSpecoraEmbedConfig()).toBeUndefined();
    expect(isSdkEmbeddedContext()).toBe(false);
  });

  it("detects SDK embedded context from window config", () => {
    window.__SPECORA_EMBED__ = { specUrl: "/api-docs/openapi.json" };
    expect(getSpecoraEmbedConfig()?.specUrl).toBe("/api-docs/openapi.json");
    expect(isSdkEmbeddedContext()).toBe(true);
  });

  it("hides workspace management when embedded on full surface", () => {
    window.__SPECORA_EMBED__ = { specUrl: "/api-docs/openapi.json" };
    expect(showWorkspaceManagement()).toBe(false);
    expect(showImportSpec()).toBe(false);
  });

  it("shows workspace management on hosted full surface", () => {
    expect(showWorkspaceManagement()).toBe(true);
    expect(showImportSpec()).toBe(true);
    expect(showTryOutPanel()).toBe(true);
  });

  it("enables try-out panel when SDK injects specUrl", () => {
    window.__SPECORA_EMBED__ = { specUrl: "/api-docs/openapi.json" };
    expect(showTryOutPanel()).toBe(true);
  });
});
