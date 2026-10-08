import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { isBlockedAddress } from "../src/http/safe-fetch.js";
import { Client, freshApp } from "./helpers.js";

let upstream: Server;
let upstreamUrl = "";

before(async () => {
  upstream = createServer((req, res) => {
    if (req.url === "/redirect") {
      res.writeHead(302, { location: "/missing" });
      res.end();
      return;
    }
    if (req.url === "/missing") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: "no such pet" }));
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ method: req.method, auth: req.headers.authorization ?? null }));
  });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  upstreamUrl = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
});

after(() => {
  upstream.close();
});

describe("address blocking", () => {
  it("blocks private, loopback, metadata and mapped addresses", () => {
    for (const address of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "fd00::1", "fe80::1"]) {
      assert.equal(isBlockedAddress(address), true, address);
    }
  });

  it("allows public addresses", () => {
    for (const address of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) {
      assert.equal(isBlockedAddress(address), false, address);
    }
  });
});

describe("POST /proxy", () => {
  it("is disabled unless PROXY_ENABLED=true", async () => {
    const client = new Client(await freshApp());
    const response = await client.request("/proxy", { method: "POST", body: { url: "https://example.com" } });
    assert.equal(response.status, 403);
  });

  it("blocks private targets by default", async () => {
    const client = new Client(await freshApp({ PROXY_ENABLED: "true" }));
    for (const url of [upstreamUrl, "http://localhost:1/", "http://[::ffff:127.0.0.1]/", "http://169.254.169.254/latest", "file:///etc/passwd"]) {
      const response = await client.request("/proxy", { method: "POST", body: { url } });
      assert.equal(response.status, 400, url);
      assert.equal(response.json.ok, false);
    }
  });

  it("relays requests and preserves upstream error bodies", async () => {
    const client = new Client(await freshApp({ PROXY_ENABLED: "true", PROXY_ALLOW_PRIVATE_NETWORKS: "true" }));

    const ok = await client.request("/proxy", {
      method: "POST",
      body: { url: `${upstreamUrl}/pets`, method: "post", headers: { authorization: "Bearer t" }, body: "{}" },
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.json.status, 200);
    assert.deepEqual(JSON.parse(ok.json.body), { method: "POST", auth: "Bearer t" });

    const notFound = await client.request("/proxy", { method: "POST", body: { url: `${upstreamUrl}/redirect` } });
    assert.equal(notFound.status, 502);
    assert.equal(notFound.json.status, 404);
    assert.deepEqual(JSON.parse(notFound.json.body), { message: "no such pet" });
  });

  it("requires a url", async () => {
    const client = new Client(await freshApp({ PROXY_ENABLED: "true" }));
    assert.equal((await client.request("/proxy", { method: "POST", body: {} })).status, 400);
  });
});
