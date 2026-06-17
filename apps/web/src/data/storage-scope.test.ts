import { afterEach, describe, expect, it } from "vitest";
import {
  getEmbedWorkspaceId,
  getStorageScopeHash,
  getStorageScopeId,
  scopedKey,
} from "./storage-scope";

describe("storage-scope", () => {
  afterEach(() => {
    delete window.__SPECORA_EMBED__;
  });

  it("uses origin and pathname when not embedded", () => {
    Object.defineProperty(window, "location", {
      value: { origin: "https://api.example.com", pathname: "/docs/" },
      writable: true,
      configurable: true,
    });

    expect(getStorageScopeId()).toBe("https://api.example.com/docs");
  });

  it("prefers embed mountPath over pathname", () => {
    Object.defineProperty(window, "location", {
      value: { origin: "https://api.example.com", pathname: "/" },
      writable: true,
      configurable: true,
    });
    window.__SPECORA_EMBED__ = {
      mountPath: "/api-docs",
      specUrl: "/v2/openapi.json",
    };

    expect(getStorageScopeId()).toBe("https://api.example.com/api-docs");
  });

  it("falls back to resolved specUrl when mountPath is absent", () => {
    Object.defineProperty(window, "location", {
      value: { origin: "https://api.example.com", pathname: "/" },
      writable: true,
      configurable: true,
    });
    window.__SPECORA_EMBED__ = {
      specUrl: "/api-docs/openapi.json",
    };

    expect(getStorageScopeId()).toBe("https://api.example.com/api-docs/openapi.json");
  });

  it("produces stable scoped keys and embed workspace ids", () => {
    Object.defineProperty(window, "location", {
      value: { origin: "https://api.example.com", pathname: "/api-docs" },
      writable: true,
      configurable: true,
    });

    const hash = getStorageScopeHash();
    expect(scopedKey("workspaces")).toBe(`specora:${hash}:workspaces`);
    expect(getEmbedWorkspaceId()).toBe(`embed-${hash}`);
    expect(getStorageScopeHash()).toBe(getStorageScopeHash());
  });

  it("scopes different paths independently", () => {
    Object.defineProperty(window, "location", {
      value: { origin: "https://api.example.com", pathname: "/api-docs" },
      writable: true,
      configurable: true,
    });
    const docsHash = getStorageScopeHash();

    Object.defineProperty(window, "location", {
      value: { origin: "https://api.example.com", pathname: "/v2-docs" },
      writable: true,
      configurable: true,
    });
    const v2Hash = getStorageScopeHash();

    expect(docsHash).not.toBe(v2Hash);
  });
});
