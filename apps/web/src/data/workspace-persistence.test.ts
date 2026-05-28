import { beforeEach, describe, expect, it } from "vitest";
import {
  getPersistedActiveWorkspaceId,
  loadPersistedWorkspaces,
  savePersistedWorkspaces,
  setPersistedActiveWorkspaceId,
} from "./workspace-persistence";

const fixtureSpec = {
  openapi: "3.0.3",
  info: { title: "Persisted API", version: "1.0.0" },
  paths: {
    "/items": {
      get: { summary: "List", responses: { "200": { description: "ok" } } },
    },
  },
};

describe("workspace persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips workspace spec through storage", async () => {
    const workspaceId = "ws-persist-1";
    await savePersistedWorkspaces([
      {
        id: workspaceId,
        name: "Test",
        specSource: { type: "text", value: "openapi: 3.0.3" },
        spec: fixtureSpec,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    await setPersistedActiveWorkspaceId(workspaceId);

    const loaded = await loadPersistedWorkspaces();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.spec?.info).toEqual({ title: "Persisted API", version: "1.0.0" });
    expect(await getPersistedActiveWorkspaceId()).toBe(workspaceId);
  });
});
