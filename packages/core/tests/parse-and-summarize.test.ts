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
