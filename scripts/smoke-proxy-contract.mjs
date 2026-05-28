import { createServer } from "node:http";
import { startProxyServer } from "../packages/cli/src/server/proxy-server.ts";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function stopServer(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function waitForPort(server) {
  const existing = server.address();
  if (existing && typeof existing !== "string") return existing.port;
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to resolve listening port.");
  }
  return address.port;
}

async function startFixtureServer() {
  const server = createServer((req, res) => {
    if (req.url === "/ok") {
      res.statusCode = 200;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }
    if (req.url === "/boom") {
      res.statusCode = 500;
      res.setHeader("content-type", "text/plain");
      res.end("boom");
      return;
    }
    res.statusCode = 404;
    res.end("not-found");
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to resolve fixture server port.");
  }
  return { server, port: address.port };
}

async function postProxy(proxyPort, payload) {
  return fetch(`http://127.0.0.1:${proxyPort}/proxy`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

async function run() {
  const fixture = await startFixtureServer();
  const proxy = startProxyServer(0);
  const proxyPort = await waitForPort(proxy);

  try {
    const success = await postProxy(proxyPort, {
      url: `http://127.0.0.1:${fixture.port}/ok`,
      method: "GET"
    });
    const successPayload = await success.json();
    assert(success.status === 200, `Expected 200 success envelope, got ${success.status}`);
    assert(successPayload.ok === true, "Expected success payload ok=true");
    assert(successPayload.status === 200, `Expected upstream status 200, got ${successPayload.status}`);

    const upstreamFail = await postProxy(proxyPort, {
      url: `http://127.0.0.1:${fixture.port}/boom`,
      method: "GET"
    });
    const upstreamPayload = await upstreamFail.json();
    assert(upstreamFail.status === 502, `Expected 502 for upstream 5xx, got ${upstreamFail.status}`);
    assert(upstreamPayload.ok === false, "Expected upstream failure payload ok=false");
    assert(upstreamPayload.status === 500, `Expected propagated upstream status 500, got ${upstreamPayload.status}`);
    assert(upstreamPayload.error === "Target returned HTTP 500", "Unexpected upstream error message");

    const invalid = await postProxy(proxyPort, {
      url: "invalid-url",
      method: "GET"
    });
    const invalidPayload = await invalid.json();
    assert(invalid.status === 400, `Expected 400 for invalid URL, got ${invalid.status}`);
    assert(invalidPayload.ok === false, "Expected invalid-url payload ok=false");
    assert(invalidPayload.error === "Invalid target URL.", "Unexpected invalid-url message");

    console.log("smoke:proxy-contract PASS");
  } finally {
    await stopServer(proxy);
    await stopServer(fixture.server);
  }
}

run().catch((error) => {
  console.error("smoke:proxy-contract FAIL");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
