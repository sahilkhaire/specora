import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { unlinkSync } from "node:fs";
import path from "node:path";
import { initDb } from "../src/db/client.js";
import { ensureDefaultInstance } from "../src/routes/admin.js";
import { createApp } from "../src/app.js";

const testDbPath = path.join(process.cwd(), "tests", ".test-specora.db");

before(() => {
  process.env.DATABASE_URL = `file:${testDbPath}`;
  initDb();
});

after(() => {
  try {
    unlinkSync(testDbPath);
  } catch {
    /* ignore */
  }
});

describe("API health", () => {
  it("returns ok", async () => {
    await ensureDefaultInstance();
    const app = createApp();
    const response = await app.request("/health");
    assert.equal(response.status, 200);
    const body = (await response.json()) as { ok: boolean };
    assert.equal(body.ok, true);
  });
});
