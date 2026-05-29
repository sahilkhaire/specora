import { describe, expect, it } from "vitest";
import {
  capExchangesForRequest,
  MAX_EXCHANGES_PER_REQUEST,
  migrateCollectionState
} from "./collection-migrate";
import type { SavedExchange } from "./collection-types";

function makeExchange(id: string, savedRequestId: string, createdAt: string): SavedExchange {
  return {
    id,
    savedRequestId,
    name: id,
    requestSnapshot: {
      method: "GET",
      url: "/test",
      pathParams: {},
      queryParams: {},
      headers: {},
      body: { mode: "none", content: "" }
    },
    response: {
      status: 200,
      durationMs: 10,
      headers: {},
      body: "{}"
    },
    createdAt
  };
}

describe("migrateCollectionState", () => {
  it("returns empty v2 state for null input", () => {
    expect(migrateCollectionState(null)).toEqual({
      version: 2,
      specFingerprint: "",
      nodes: [],
      requests: [],
      exchanges: []
    });
  });

  it("migrates v1 state to v2 with empty exchanges", () => {
    const v1 = {
      version: 1 as const,
      specFingerprint: "fp",
      nodes: [],
      requests: [{ id: "req_1", name: "Test", method: "GET", url: "/", source: "custom" as const, pathParams: {}, queryParams: {}, headers: {}, body: { mode: "none" as const, content: "" }, updatedAt: "2026-01-01" }]
    };

    const migrated = migrateCollectionState(v1);
    expect(migrated.version).toBe(2);
    expect(migrated.exchanges).toEqual([]);
    expect(migrated.requests).toHaveLength(1);
  });

  it("preserves exchanges on v2 state", () => {
    const exchange = makeExchange("ex_1", "req_1", "2026-01-01T00:00:00.000Z");
    const v2 = {
      version: 2 as const,
      specFingerprint: "fp",
      nodes: [],
      requests: [],
      exchanges: [exchange]
    };

    expect(migrateCollectionState(v2).exchanges).toEqual([exchange]);
  });
});

describe("capExchangesForRequest", () => {
  it("keeps all exchanges when under cap", () => {
    const exchanges = [
      makeExchange("ex_1", "req_a", "2026-01-03T00:00:00.000Z"),
      makeExchange("ex_2", "req_b", "2026-01-02T00:00:00.000Z")
    ];

    expect(capExchangesForRequest(exchanges, "req_a")).toEqual(exchanges);
  });

  it("drops oldest exchanges for a request when over cap", () => {
    const reqId = "req_a";
    const exchanges: SavedExchange[] = [];

    for (let i = 0; i < MAX_EXCHANGES_PER_REQUEST + 5; i++) {
      exchanges.push(
        makeExchange(`ex_${i}`, reqId, new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString())
      );
    }

    exchanges.push(makeExchange("other_1", "req_b", "2026-02-01T00:00:00.000Z"));

    const capped = capExchangesForRequest(exchanges, reqId);
    const forRequest = capped
      .filter((e) => e.savedRequestId === reqId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    expect(forRequest).toHaveLength(MAX_EXCHANGES_PER_REQUEST);
    expect(capped.some((e) => e.id === "other_1")).toBe(true);
    expect(forRequest[0]?.id).toBe(`ex_${MAX_EXCHANGES_PER_REQUEST + 4}`);
  });
});
