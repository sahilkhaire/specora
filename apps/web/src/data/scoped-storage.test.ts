import { beforeEach, describe, expect, it } from "vitest";
import { readScopedItem, writeScopedItem } from "./scoped-storage";
import { scopedKey } from "./storage-scope";

describe("scoped-storage", () => {
  beforeEach(() => {
    localStorage.clear();
    delete window.__SPECORA_EMBED__;
    Object.defineProperty(window, "location", {
      value: { origin: "https://api.example.com", pathname: "/docs" },
      writable: true,
      configurable: true,
    });
  });

  it("migrates legacy specora-prefixed keys on read", () => {
    localStorage.setItem("specora:workspaces", JSON.stringify([{ id: "ws-1" }]));

    expect(readScopedItem("workspaces")).toContain("ws-1");
    expect(localStorage.getItem(scopedKey("workspaces"))).toContain("ws-1");
  });

  it("migrates custom legacy keys on read", () => {
    localStorage.setItem("specora-theme-mode", "dark");

    expect(readScopedItem("theme-mode", "specora-theme-mode")).toBe("dark");
    expect(localStorage.getItem(scopedKey("theme-mode"))).toBe("dark");
  });

  it("writes only to scoped keys", () => {
    writeScopedItem("activeEnvId", "env-1");

    expect(localStorage.getItem(scopedKey("activeEnvId"))).toBe("env-1");
    expect(localStorage.getItem("specora:activeEnvId")).toBeNull();
  });
});
