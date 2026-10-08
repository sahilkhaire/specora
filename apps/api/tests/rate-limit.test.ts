import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Client, freshApp } from "./helpers.js";

describe("rate limiting", () => {
  it("throttles repeated login attempts", async () => {
    const client = new Client(await freshApp());
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) {
      const response = await client.request("/auth/login", { method: "POST", body: { email: "x@example.com", password: "wrong-password" } });
      statuses.push(response.status);
    }
    assert.equal(statuses.slice(0, 20).every((status) => status === 401), true);
    assert.equal(statuses[20], 429);
  });
});
