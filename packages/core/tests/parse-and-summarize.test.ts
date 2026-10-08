import { strict as assert } from "node:assert";
import test from "node:test";
import { parseAndValidateSpec, summarizeSpec } from "../src/index.js";

const validJsonSpec = JSON.stringify(
  {
    openapi: "3.0.3",
    info: {
      title: "Specora Pet API",
      version: "1.0.0"
    },
    paths: {
      "/pets": {
        get: {
          summary: "List pets",
          tags: ["pets"],
          responses: {
            "200": {
              description: "List response"
            }
          }
        },
        post: {
          summary: "Create pet",
          tags: ["pets", "write"],
          responses: {
            "201": {
              description: "Created"
            }
          }
        }
      },
      "/health": {
        get: {
          summary: "Health check",
          tags: ["system"],
          responses: {
            "200": {
              description: "Healthy"
            }
          }
        }
      }
    }
  },
  null,
  2
);

const validYamlSpec = `
openapi: 3.0.3
info:
  title: Specora Billing API
  version: 2.1.0
paths:
  /invoices:
    get:
      summary: List invoices
      tags:
        - billing
      responses:
        "200":
          description: Invoice list
`;

test("parseAndValidateSpec parses valid JSON", async () => {
  const result = await parseAndValidateSpec({ sourceType: "text", value: validJsonSpec });
  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.spec.info && (result.spec.info as { title?: string }).title, "Specora Pet API");
  }
});

test("parseAndValidateSpec parses valid YAML", async () => {
  const result = await parseAndValidateSpec({ sourceType: "text", value: validYamlSpec });
  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.spec.info && (result.spec.info as { version?: string }).version, "2.1.0");
  }
});

test("parseAndValidateSpec fails on empty content", async () => {
  const result = await parseAndValidateSpec({ sourceType: "text", value: "   " });
  assert.equal(result.ok, false);

  if (!result.ok) {
    assert.match(result.error.message, /empty/i);
  }
});

test("parseAndValidateSpec fails on malformed JSON", async () => {
  const result = await parseAndValidateSpec({
    sourceType: "text",
    value: '{ "openapi": "3.0.3", "info": { "title": "bad" '
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.error.hint);
  }
});

test("summarizeSpec returns title, version, path count, and sorted tags", () => {
  const spec = JSON.parse(validJsonSpec) as Record<string, unknown>;
  const summary = summarizeSpec(spec);

  assert.equal(summary.title, "Specora Pet API");
  assert.equal(summary.version, "1.0.0");
  assert.equal(summary.endpointCount, 2);
  assert.deepEqual(summary.tags, ["pets", "system", "write"]);
});

test("validation does not mutate recursive schemas into circular objects", async () => {
  const text = JSON.stringify({
    openapi: "3.0.0",
    info: { title: "Tree", version: "1" },
    paths: {
      "/nodes": {
        get: {
          responses: {
            "200": { description: "ok", content: { "application/json": { schema: { $ref: "#/components/schemas/Node" } } } }
          }
        }
      }
    },
    components: { schemas: { Node: { type: "object", properties: { child: { $ref: "#/components/schemas/Node" } } } } }
  });
  const result = await parseAndValidateSpec({ sourceType: "text", value: text });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.doesNotThrow(() => JSON.stringify(result.spec));
  }
});

test("rejects YAML that is not an object", async () => {
  const result = await parseAndValidateSpec({ sourceType: "text", value: "just a string" });
  assert.equal(result.ok, false);
});

test("detectDefaultServerUrl skips malformed entries and fills variable defaults", async () => {
  const { detectDefaultServerUrl } = await import("../src/index.js");
  assert.equal(
    detectDefaultServerUrl({ servers: [null, 5, { url: 7 }, { url: "https://{region}.api.example.com", variables: { region: { default: "eu" } } }] }),
    "https://eu.api.example.com"
  );
  assert.equal(detectDefaultServerUrl({ swagger: "2.0", host: "api.example.com", basePath: "/v1" }), "https://api.example.com/v1");
  assert.equal(detectDefaultServerUrl({}), "");
});
