import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  detectSpecVersion,
  extractOperations,
  detectDefaultServerUrl,
  parseSpecTextSync
} from "../src/index.js";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function loadFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf8");
}

void (async () => {
  const swagger20 = JSON.parse(loadFixture("swagger-2.0-minimal.json")) as Record<string, unknown>;
  const v20 = detectSpecVersion(swagger20);
  assert.equal(v20.kind, "swagger-2.0");
  assert.equal(v20.label, "Swagger 2.0");

  const ops20 = extractOperations(swagger20);
  assert.equal(ops20.length, 1);
  assert.equal(ops20[0]?.method, "GET");
  assert.match(detectDefaultServerUrl(swagger20), /api\.example\.com/);

  const oas31Text = loadFixture("openapi-3.1-minimal.yaml");
  const parsed31 = parseSpecTextSync(oas31Text);
  assert.equal(parsed31.ok, true);
  if (parsed31.ok) {
    assert.equal(parsed31.version.kind, "openapi-3.1");
    const ops31 = extractOperations(parsed31.spec);
    assert.equal(ops31.length, 1);
    assert.equal(ops31[0]?.operationId, "listItems");
  }

  const oas30Text = loadFixture("valid-openapi.yaml");
  const parsed30 = parseSpecTextSync(oas30Text);
  assert.equal(parsed30.ok, true);
  if (parsed30.ok) {
    assert.equal(parsed30.version.kind, "openapi-3.0");
  }

  console.log("spec-version-matrix.test.ts: ok");
})();
