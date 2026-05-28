import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { defaultCacheDir } from "../src/cache.js";

describe("embed-core cache", () => {
  it("returns default cache path", () => {
    assert.ok(defaultCacheDir().includes(".cache"));
  });
});
