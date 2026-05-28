import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterPublicOperations } from "../src/parsing/public-endpoints.js";
import type { OperationItem } from "../src/parsing/operation-types.js";

const operations: OperationItem[] = [
  {
    key: "GET:/public:",
    method: "GET",
    path: "/public",
    summary: "Public",
    operationId: "",
    tags: ["public"],
    description: "",
    parameters: [],
    requestBody: null,
    searchTextLower: "get /public public"
  },
  {
    key: "GET:/internal:",
    method: "GET",
    path: "/internal",
    summary: "Internal",
    operationId: "",
    tags: ["admin"],
    description: "",
    parameters: [],
    requestBody: null,
    searchTextLower: "get /internal internal"
  },
];

const paths = {
  "/public": {
    get: { tags: ["public"], security: [] },
  },
  "/internal": {
    get: { tags: ["admin"], security: [{ bearer: [] }] },
  },
};

describe("filterPublicOperations", () => {
  it("filters by public tag by default", () => {
    const filtered = filterPublicOperations(operations, paths);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]?.path, "/public");
  });

  it("returns all when includeAll is set", () => {
    const filtered = filterPublicOperations(operations, paths, { includeAll: true });
    assert.equal(filtered.length, 2);
  });
});
