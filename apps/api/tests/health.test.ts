import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Client, freshApp } from "./helpers.js";

describe("API basics", () => {
  it("reports health with database status", async () => {
    const client = new Client(await freshApp());
    const response = await client.request("/health");
    assert.equal(response.status, 200);
    assert.deepEqual(response.json, { ok: true, db: "up" });
  });

  it("returns JSON 404 for unknown routes", async () => {
    const client = new Client(await freshApp());
    const response = await client.request("/nope");
    assert.equal(response.status, 404);
    assert.equal(response.json.error, "Not found");
  });

  it("returns 400, not 500, for malformed JSON", async () => {
    const client = new Client(await freshApp());
    const response = await client.request("/auth/login", { method: "POST", body: "{not json" });
    assert.equal(response.status, 400);
  });

  it("sets security headers", async () => {
    const client = new Client(await freshApp());
    const response = await client.request("/health");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  });
});
