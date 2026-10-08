import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DataProvider } from "@/data/DataProvider";
import { createLocalStorageStores } from "@/data/local-storage-stores";
import { getEmbedWorkspaceId, scopedKey } from "@/data/storage-scope";
import { computeSpecFingerprint } from "./collection-bootstrap";
import { useCollections } from "./use-collections";

function wrapper({ children }: { children: React.ReactNode }) {
  return <DataProvider>{children}</DataProvider>;
}

const specV1: Record<string, unknown> = {
  openapi: "3.0.3",
  info: { title: "V1", version: "1.0.0" },
  paths: {
    "/alpha": {
      get: { summary: "Alpha", responses: { "200": { description: "ok" } } },
    },
  },
};

const specV2: Record<string, unknown> = {
  openapi: "3.0.3",
  info: { title: "V2", version: "2.0.0" },
  paths: {
    "/beta": {
      get: { summary: "Beta", responses: { "200": { description: "ok" } } },
    },
  },
};

describe("useCollections embed priority", () => {
  beforeEach(() => {
    localStorage.clear();
    delete window.__SPECORA_EMBED__;
    Object.defineProperty(window, "location", {
      value: { origin: "https://api.example.com", pathname: "/" },
      writable: true,
      configurable: true,
    });
    window.__SPECORA_EMBED__ = { mountPath: "/api-docs" };
  });

  it("rebootstraps from the loaded spec when embed fingerprint changes", async () => {
    const workspaceId = getEmbedWorkspaceId();
    const stores = createLocalStorageStores();
    await stores.collections.save(workspaceId, {
      version: 2,
      specFingerprint: computeSpecFingerprint(specV1),
      nodes: [
        {
          id: "node-old",
          kind: "request",
          name: "Alpha",
          parentId: null,
          sortOrder: 0,
          requestId: "req-old",
        },
      ],
      requests: [
        {
          id: "req-old",
          name: "Alpha",
          method: "GET",
          url: "/alpha",
          source: "openapi",
          operationKey: "GET:/alpha",
          pathParams: {},
          queryParams: {},
          headers: {},
          body: { mode: "none", content: "" },
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      exchanges: [],
    });

    const { result, rerender } = renderHook(
      ({ spec }: { spec: Record<string, unknown> }) => useCollections(workspaceId, spec),
      { wrapper, initialProps: { spec: specV1 } }
    );

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
      expect(result.current.state.requests.some((request) => request.url === "/alpha")).toBe(true);
    });

    rerender({ spec: specV2 });

    await waitFor(() => {
      expect(result.current.state.requests.some((request) => request.url === "/beta")).toBe(true);
      expect(result.current.state.requests.some((request) => request.url === "/alpha")).toBe(false);
    });

    expect(localStorage.getItem(scopedKey(`collections:${workspaceId}`))).toContain("/beta");
  });
});

describe("useCollections state integrity", () => {
  beforeEach(() => {
    localStorage.clear();
    delete window.__SPECORA_EMBED__;
    Object.defineProperty(window, "location", {
      value: { origin: "https://app.example.com", pathname: "/" },
      writable: true,
      configurable: true,
    });
  });

  it("keeps both updates when two are applied in the same tick", async () => {
    const { result } = renderHook(() => useCollections("ws-a", specV1), { wrapper });
    await waitFor(() => expect(result.current.state.requests.length).toBe(1));
    const id = result.current.state.requests[0]!.id;

    act(() => {
      result.current.updateRequest(id, { headers: { "x-one": "1" } });
      result.current.updateRequest(id, { body: { mode: "json", content: "{}" } });
    });

    const request = result.current.state.requests[0]!;
    expect(request.headers).toEqual({ "x-one": "1" });
    expect(request.body.content).toBe("{}");
  });

  it("does not save one workspace's collection under another workspace", async () => {
    const { result, rerender } = renderHook(
      ({ workspaceId, spec }: { workspaceId: string; spec: Record<string, unknown> }) =>
        useCollections(workspaceId, spec),
      { wrapper, initialProps: { workspaceId: "ws-a", spec: specV1 } }
    );
    await waitFor(() => expect(result.current.state.requests.some((r) => r.url === "/alpha")).toBe(true));

    rerender({ workspaceId: "ws-b", spec: specV2 });
    await waitFor(() => expect(result.current.state.requests.some((r) => r.url === "/beta")).toBe(true));

    const storedB = localStorage.getItem(scopedKey("collections:ws-b")) ?? "";
    expect(storedB).toContain("/beta");
    expect(storedB).not.toContain("/alpha");
    expect(localStorage.getItem(scopedKey("collections:ws-a"))).toContain("/alpha");
  });
});
