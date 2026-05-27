import { describe, expect, it } from "vitest";
import { extractOperations, filterOperations, parseSpecText, groupOperationsByTags } from "./spec-utils";

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

  it("auto-processes Go template syntax", () => {
    const templateContent = `{
      "schemes": {{ marshal .Schemes }},
      "swagger": "2.0",
      "info": {
        "title": "{{.Title}}",
        "description": "{{escape .Description}}",
        "version": "{{.Version}}"
      },
      "host": "{{.Host}}",
      "basePath": "{{.BasePath}}",
      "paths": {}
    }`;
    const result = parseSpecText(templateContent);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.spec.swagger).toBe("2.0");
      expect(result.spec.schemes).toEqual(["https"]);
      expect(result.spec.host).toBeTruthy();
    }
  });

  it("detects HTML responses", () => {
    const htmlContent = `<!DOCTYPE html>
    <html>
      <head><title>Error</title></head>
      <body>404 Not Found</body>
    </html>`;
    const result = parseSpecText(htmlContent);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("HTML");
    }
  });

  it("provides helpful error for invalid JSON", () => {
    const invalidJson = `{ "openapi": "3.0.0", "info": { "title": "Test" }`;
    const result = parseSpecText(invalidJson);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("JSON parse error");
    }
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

  it("groups operations by tags", () => {
    const parsed = parseSpecText(fixture);
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    const operations = extractOperations(parsed.spec);
    const grouped = groupOperationsByTags(operations);

    expect(grouped).toHaveLength(2);
    expect(grouped[0]?.tag).toBe("orders");
    expect(grouped[0]?.operations).toHaveLength(1);
    expect(grouped[1]?.tag).toBe("pets");
    expect(grouped[1]?.operations).toHaveLength(1);
  });

  it("groups operations without tags into 'Untagged'", () => {
    const specWithUntagged = `
openapi: 3.0.3
info:
  title: Test API
  version: 1.0.0
paths:
  /tagged:
    get:
      summary: Tagged endpoint
      tags: [api]
      responses:
        "200":
          description: ok
  /untagged:
    get:
      summary: Untagged endpoint
      responses:
        "200":
          description: ok
`;
    const parsed = parseSpecText(specWithUntagged);
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    const operations = extractOperations(parsed.spec);
    const grouped = groupOperationsByTags(operations);

    expect(grouped).toHaveLength(2);
    const apiGroup = grouped.find((g) => g.tag === "api");
    const untaggedGroup = grouped.find((g) => g.tag === "Untagged");

    expect(apiGroup).toBeDefined();
    expect(apiGroup?.operations).toHaveLength(1);
    expect(untaggedGroup).toBeDefined();
    expect(untaggedGroup?.operations).toHaveLength(1);
  });
});
