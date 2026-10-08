import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import express from "express";
import type { Server } from "node:http";
import { specoraDocs } from "../src/express.js";

let server: Server;
let base = "";

before(async () => {
  const dir = await mkdtemp(join(tmpdir(), "specora-node-"));
  const specPath = join(dir, "openapi.yaml");
  await writeFile(specPath, "openapi: 3.0.0\ninfo:\n  title: Test\n  version: '1'\npaths: {}\n");

  const app = express();
  // Unreachable CDN: asset loading fails, which must not crash the host app.
  app.use(specoraDocs({ specPath, mountPath: "/api-docs", cdnBase: "http://127.0.0.1:9", cacheDir: dir }));
  app.get("/", (_req, res) => {
    res.send("host app root");
  });
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
});

describe("specoraDocs express middleware", () => {
  it("serves the spec as JSON and YAML under the mount path", async () => {
    const json = await fetch(`${base}/api-docs/openapi.json`);
    assert.equal(json.status, 200);
    assert.equal(((await json.json()) as { info: { title: string } }).info.title, "Test");

    const yaml = await fetch(`${base}/api-docs/openapi.yaml`);
    assert.equal(yaml.status, 200);
    assert.match(await yaml.text(), /title: Test/);
  });

  it("does not hijack the host app's own routes", async () => {
    const root = await fetch(`${base}/`);
    assert.equal(await root.text(), "host app root");
  });

  it("returns 503 instead of crashing when embed assets are unavailable", async () => {
    const docs = await fetch(`${base}/api-docs`);
    assert.equal(docs.status, 503);
  });
});
