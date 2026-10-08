import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildBootstrapHtml } from "../src/html.js";

describe("buildBootstrapHtml", () => {
  it("injects download URLs into embed config", () => {
    const html = buildBootstrapHtml("<html><head></head><body></body></html>", {
      specPath: "./openapi.yaml",
      specUrl: "/api-docs/openapi.json",
      mountPath: "/api-docs",
      downloadJsonUrl: "/api-docs/openapi.json",
      downloadYamlUrl: "/api-docs/openapi.yaml",
    });

    assert.match(html, /window\.__SPECORA_EMBED__=/);
    assert.match(html, /"downloadJsonUrl":"\/api-docs\/openapi\.json"/);
    assert.match(html, /"downloadYamlUrl":"\/api-docs\/openapi\.yaml"/);
  });

  it("defaults downloadJsonUrl to specUrl", () => {
    const html = buildBootstrapHtml("<html><head></head><body></body></html>", {
      specPath: "./openapi.json",
      specUrl: "/api-docs/openapi.json",
      mountPath: "/api-docs",
    });

    assert.match(html, /"downloadJsonUrl":"\/api-docs\/openapi\.json"/);
    assert.doesNotMatch(html, /downloadYamlUrl/);
  });

  it("escapes values that could close the inline script", () => {
    const html = buildBootstrapHtml("<html><head></head><body></body></html>", {
      specPath: "./openapi.json",
      specUrl: "/docs/</script><script>alert(1)</script>",
      mountPath: "/docs",
    });

    assert.doesNotMatch(html, /<\/script><script>alert/);
    const config = html.match(/__SPECORA_EMBED__=(.*?);<\/script>/)?.[1] ?? "";
    assert.equal(JSON.parse(config).specUrl, "/docs/</script><script>alert(1)</script>");
  });
});
