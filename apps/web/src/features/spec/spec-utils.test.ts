import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractOperations,
  filterOperations,
  findOperationByKey,
  getOperationKeyFromLocation,
  OPERATION_URL_PARAM,
  parseSpecText,
  groupOperationsByTags,
  getUsedSchemasForOperation,
  getUsedSchemaDetailsForOperation,
  setOperationKeyInLocation
} from "./spec-utils";

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
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
      expect(result.error).toMatch(/JSON parse error|Parse error/i);
    }
  });

  it("reads operation keys from the URL query string", () => {
    expect(getOperationKeyFromLocation({ search: `?${OPERATION_URL_PARAM}=POST%3A%2Forders%3AcreateOrder` }))
      .toBe("POST:/orders:createOrder");
    expect(getOperationKeyFromLocation({ search: "" })).toBeNull();
  });

  it("writes operation keys through the history API", () => {
    const replaceState = vi.spyOn(window.history, "replaceState").mockImplementation(() => undefined);

    setOperationKeyInLocation("GET:/pets:", { replace: true });

    const urlArg = replaceState.mock.calls[0]?.[2];
    expect(String(urlArg)).toContain(`${OPERATION_URL_PARAM}=GET%3A%2Fpets%3A`);
  });

  it("finds operations by stable key", () => {
    const parsed = parseSpecText(fixture);
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    const operations = extractOperations(parsed.spec);
    const match = findOperationByKey(operations, "GET:/pets:");
    expect(match?.summary).toBe("List pets");
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

  it("hides non-matching tag groups when search matches a tag name", () => {
    const specWithMultiTag = `
openapi: 3.0.3
info:
  title: Multi-tag API
  version: 1.0.0
paths:
  /pets:
    get:
      summary: List pets
      tags: [pets, admin]
      responses:
        "200":
          description: ok
`;
    const parsed = parseSpecText(specWithMultiTag);
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    const operations = extractOperations(parsed.spec);
    const filtered = filterOperations(operations, "ALL", "pets");
    const grouped = groupOperationsByTags(filtered, "pets");

    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.tag).toBe("pets");
    expect(grouped[0]?.operations).toHaveLength(1);
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

  it("returns used schemas for an operation including nested references", () => {
    const specText = `
openapi: 3.0.3
info:
  title: Used Schemas API
  version: 1.0.0
paths:
  /orders:
    post:
      summary: Create order
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateOrderRequest'
      responses:
        "201":
          description: created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Order'
components:
  schemas:
    CreateOrderRequest:
      type: object
      properties:
        customer:
          $ref: '#/components/schemas/Customer'
    Order:
      type: object
      properties:
        id:
          type: string
        customer:
          $ref: '#/components/schemas/Customer'
    Customer:
      type: object
      properties:
        id:
          type: string
`;

    const parsed = parseSpecText(specText);
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    const used = getUsedSchemasForOperation(parsed.spec, { path: "/orders", method: "POST" });
    expect(used).toEqual(["CreateOrderRequest", "Customer", "Order"]);
  });

  it("returns inline schemas for operations without component refs", () => {
    const specText = `
openapi: 3.0.3
info:
  title: Inline Schemas API
  version: 1.0.0
paths:
  /reports:
    post:
      summary: Generate report
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                from:
                  type: string
                to:
                  type: string
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: string
`;

    const parsed = parseSpecText(specText);
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    const used = getUsedSchemaDetailsForOperation(parsed.spec, { path: "/reports", method: "POST" });
    expect(used).toHaveLength(2);
    expect(used.map((schema) => schema.name)).toEqual([
      "Request Body (application/json)",
      "Response 200 (application/json)"
    ]);
    expect(used.every((schema) => schema.source === "inline")).toBe(true);
  });

  it("includes Swagger 2 definitions referenced by endpoint responses", () => {
    const specText = `
swagger: "2.0"
info:
  title: Swagger Definitions API
  version: 1.0.0
paths:
  /reports:
    get:
      summary: List reports
      responses:
        "200":
          description: ok
          schema:
            $ref: '#/definitions/ReportList'
definitions:
  ReportList:
    type: object
    properties:
      items:
        type: array
        items:
          $ref: '#/definitions/Report'
  Report:
    type: object
    properties:
      id:
        type: string
`;

    const parsed = parseSpecText(specText);
    if (!parsed.ok) {
      throw new Error(parsed.error);
    }

    const usedNames = getUsedSchemasForOperation(parsed.spec, { path: "/reports", method: "GET" });
    expect(usedNames).toEqual(["Report", "ReportList"]);

    const details = getUsedSchemaDetailsForOperation(parsed.spec, { path: "/reports", method: "GET" });
    expect(details.map((detail) => detail.name)).toContain("ReportList");
    expect(details.map((detail) => detail.name)).toContain("Report");
  });
});
