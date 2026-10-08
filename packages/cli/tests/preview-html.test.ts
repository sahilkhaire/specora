import { strict as assert } from "node:assert";
import test from "node:test";
import { generatePreviewHtml } from "../src/server/preview-html.js";

test("preview HTML escapes spec content", () => {
  const html = generatePreviewHtml({
    summary: { title: "<script>alert(1)</script>", version: "1\"><img>", endpointCount: 0, tags: ["<b>"] } as never,
    spec: { info: { description: "</pre><script>x()</script>" } }
  });
  assert.equal(html.includes("<script>"), false);
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
});
