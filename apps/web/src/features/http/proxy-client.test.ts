import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchViaTryoutProxy } from "./proxy-client";

const request = { url: "https://api.example.com/pets/1", method: "GET", headers: {} };

describe("fetchViaTryoutProxy", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns upstream error responses instead of throwing them away", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ ok: false, status: 404, headers: { "content-type": "application/json" }, body: '{"message":"not found"}', error: "Target returned HTTP 404" }),
        { status: 502 }
      )
    );

    const result = await fetchViaTryoutProxy("http://localhost:8787/proxy", request);
    expect(result.status).toBe(404);
    expect(result.body).toBe('{"message":"not found"}');
  });

  it("throws when the proxy itself fails without an upstream status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: "Target request timed out." }), { status: 504 })
    );
    await expect(fetchViaTryoutProxy("http://localhost:8787/proxy", request)).rejects.toThrow("Target request timed out.");
  });

  it("throws a readable error for non-JSON proxy responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("<html>", { status: 500 }));
    await expect(fetchViaTryoutProxy("http://localhost:8787/proxy", request)).rejects.toThrow(/invalid JSON/);
  });
});
