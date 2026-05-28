import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { DataProvider } from "@/data/DataProvider";
import { useWorkspaces } from "./use-workspaces";

function wrapper({ children }: { children: React.ReactNode }) {
  return <DataProvider>{children}</DataProvider>;
}

const WORKSPACES_KEY = "specora:workspaces";
const ACTIVE_WORKSPACE_KEY = "specora:activeWorkspaceId";

describe("useWorkspaces", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("filters invalid records and sanitizes malformed workspace fields", async () => {
    localStorage.setItem(
      WORKSPACES_KEY,
      JSON.stringify([
        {
          id: "ws-valid",
          name: "Valid Workspace",
          specSource: null,
          spec: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "",
          name: "Invalid Missing Id",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "ws-invalid-specsource",
          name: "Invalid Spec Source",
          specSource: { type: "file", value: "{}" },
          spec: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ])
    );

    const { result } = renderHook(() => useWorkspaces(), { wrapper });

    await waitFor(() => {
      expect(result.current.workspaces.length).toBeGreaterThanOrEqual(2);
    });

    expect(result.current.workspaces).toHaveLength(2);
    expect(result.current.workspaces[0]?.id).toBe("ws-valid");
    expect(result.current.workspaces[1]?.id).toBe("ws-invalid-specsource");
    expect(result.current.workspaces[1]?.specSource).toBeNull();
  });

  it("falls back to first workspace when active workspace id is missing or invalid", async () => {
    localStorage.setItem(
      WORKSPACES_KEY,
      JSON.stringify([
        {
          id: "ws-1",
          name: "Workspace One",
          specSource: null,
          spec: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ])
    );
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, "missing-id");

    const { result } = renderHook(() => useWorkspaces(), { wrapper });

    await waitFor(() => {
      expect(result.current.activeWorkspaceId).toBe("ws-1");
    });

    expect(localStorage.getItem(ACTIVE_WORKSPACE_KEY)).toBe("ws-1");
  });
});
