import { describe, expect, it } from "vitest";
import { extractOperations, filterOperations, parseSpecText } from "./spec-utils";

const fixture = `
openapi: 3.0.3
info:
  title: Web Fixture API
  version: 1.0.0
paths:
  /pets:
    get:
      summary: List pets
      tags: [pets]
      responses:
        "200":
          description: ok
  /orders:
    post:
      summary: Create order
      tags: [orders]
      responses:
        "201":
          description: created
`;

describe("spec-utils", () => {
  it("parses valid YAML specs", () => {
    const result = parseSpecText(fixture);
    expect(result.ok).toBe(true);
  });

  it("extracts operations and supports filtering", () => {
    const parsed = parseSpecText(fixture);
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    const operations = extractOperations(parsed.spec);
    expect(operations).toHaveLength(2);

    const onlyPost = filterOperations(operations, "POST", "");
    expect(onlyPost).toHaveLength(1);
    expect(onlyPost[0]?.path).toBe("/orders");

    const searchPets = filterOperations(operations, "ALL", "pets");
    expect(searchPets).toHaveLength(1);
    expect(searchPets[0]?.path).toBe("/pets");
  });
});
