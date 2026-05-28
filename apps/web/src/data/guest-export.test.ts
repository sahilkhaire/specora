import { describe, expect, it, beforeEach } from "vitest";
import {
  exportGuestData,
  GUEST_EXPORT_VERSION,
  importGuestData,
  isGuestExportPayload,
} from "./guest-export";

describe("guest-export", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("exports and validates guest payload shape", async () => {
    const payload = await exportGuestData();
    expect(payload.version).toBe(GUEST_EXPORT_VERSION);
    expect(isGuestExportPayload(payload)).toBe(true);
    expect(Array.isArray(payload.workspaces)).toBe(true);
  });

  it("round-trips through import", async () => {
    localStorage.setItem(
      "specora:workspaces",
      JSON.stringify([
        {
          id: "ws-1",
          name: "Test",
          specSource: null,
          spec: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ])
    );
    localStorage.setItem("specora:activeWorkspaceId", "ws-1");

    const exported = await exportGuestData();
    localStorage.clear();
    await importGuestData(exported);

    const raw = localStorage.getItem("specora:workspaces");
    expect(raw).toContain("ws-1");
  });
});
