import { beforeEach, describe, expect, it } from "vitest";
import { createLocalStorageStores } from "./local-storage-stores";
import { scopedKey } from "./storage-scope";

describe("local storage stores scoping", () => {
  beforeEach(() => {
    localStorage.clear();
    delete window.__SPECORA_EMBED__;
    Object.defineProperty(window, "location", {
      value: { origin: "https://api.example.com", pathname: "/api-docs" },
      writable: true,
      configurable: true,
    });
  });

  it("isolates environments per document path", async () => {
    const storesA = createLocalStorageStores();
    await storesA.environments.save([
      {
        id: "env-a",
        name: "Docs A",
        baseUrl: "https://api.example.com",
        variables: {},
        auth: { type: "none", value: "", keyName: "X-API-Key" },
      },
    ]);
    await storesA.environments.setActiveId("env-a");

    Object.defineProperty(window, "location", {
      value: { origin: "https://api.example.com", pathname: "/v2-docs" },
      writable: true,
      configurable: true,
    });

    const storesB = createLocalStorageStores();
    expect(await storesB.environments.list()).toEqual([]);
    expect(await storesB.environments.getActiveId()).toBe("");

    Object.defineProperty(window, "location", {
      value: { origin: "https://api.example.com", pathname: "/api-docs" },
      writable: true,
      configurable: true,
    });

    const storesAAgain = createLocalStorageStores();
    expect(await storesAAgain.environments.list()).toHaveLength(1);
    expect(await storesAAgain.environments.getActiveId()).toBe("env-a");
  });

  it("writes under scoped keys", async () => {
    const stores = createLocalStorageStores();
    await stores.environments.save([
      {
        id: "env-1",
        name: "Local",
        baseUrl: "https://api.example.com",
        variables: {},
        auth: { type: "none", value: "", keyName: "X-API-Key" },
      },
    ]);

    expect(localStorage.getItem(scopedKey("environments"))).toContain("env-1");
    expect(localStorage.getItem("specora:environments")).toBeNull();
  });
});
