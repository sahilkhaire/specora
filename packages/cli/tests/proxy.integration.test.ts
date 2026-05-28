import { strict as assert } from "node:assert";
import { createServer, type IncomingMessage, type RequestListener, type Server, type ServerResponse } from "node:http";
import test from "node:test";
import { startProxyServer } from "../src/server/proxy-server.js";

async function startHttpServer(handler: RequestListener): Promise<{ server: Server; port: number }> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to acquire dynamic port.");
  }
  return { server, port: address.port };
}

async function stopServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function getListeningPort(server: Server): Promise<number> {
  const existing = server.address();
  if (existing && typeof existing !== "string") {
    return existing.port;
  }

  await new Promise<void>((resolve) => {
    server.once("listening", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to read listening port.");
  }
  return address.port;
}

test("proxy returns deterministic error for invalid target URL", async () => {
  const proxyServer = startProxyServer(0);
  const proxyPort = await getListeningPort(proxyServer);

  try {
    const response = await fetch(`http://127.0.0.1:${proxyPort}/proxy`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "invalid-url", method: "GET" })
    });

    assert.equal(response.status, 400);
    const payload = await response.json() as { ok: boolean; error: string };
    assert.equal(payload.ok, false);
    assert.equal(payload.error, "Invalid target URL.");
  } finally {
    await stopServer(proxyServer);
  }
});

test("proxy maps upstream 5xx to deterministic 502 payload", async () => {
  const upstream = await startHttpServer((_req: IncomingMessage, res: ServerResponse) => {
    res.statusCode = 500;
    res.setHeader("content-type", "text/plain");
    res.end("upstream failure");
  });

  const proxyServer = startProxyServer(0);
  const proxyPort = await getListeningPort(proxyServer);

  try {
    const response = await fetch(`http://127.0.0.1:${proxyPort}/proxy`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: `http://127.0.0.1:${upstream.port}/target`, method: "GET" })
    });

    assert.equal(response.status, 502);
    const payload = await response.json() as { ok: boolean; status: number; error: string };
    assert.equal(payload.ok, false);
    assert.equal(payload.status, 500);
    assert.equal(payload.error, "Target returned HTTP 500");
  } finally {
    await stopServer(proxyServer);
    await stopServer(upstream.server);
  }
});

test("proxy maps upstream timeout to deterministic 504 payload", async () => {
  process.env.SPECORA_PROXY_TIMEOUT_MS = "30";
  const upstream = await startHttpServer((_req: IncomingMessage, _res: ServerResponse) => {
    // Intentionally never responds to trigger timeout.
  });

  const proxyServer = startProxyServer(0);
  const proxyPort = await getListeningPort(proxyServer);

  try {
    const response = await fetch(`http://127.0.0.1:${proxyPort}/proxy`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: `http://127.0.0.1:${upstream.port}/slow`, method: "GET" })
    });

    assert.equal(response.status, 504);
    const payload = await response.json() as { ok: boolean; error: string };
    assert.equal(payload.ok, false);
    assert.equal(payload.error, "Target request timed out.");
  } finally {
    delete process.env.SPECORA_PROXY_TIMEOUT_MS;
    await stopServer(proxyServer);
    await stopServer(upstream.server);
  }
});

test("proxy maps network failure to deterministic 502 payload", async () => {
  const proxyServer = startProxyServer(0);
  const proxyPort = await getListeningPort(proxyServer);

  try {
    const response = await fetch(`http://127.0.0.1:${proxyPort}/proxy`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "http://127.0.0.1:9/unreachable", method: "GET" })
    });

    assert.equal(response.status, 502);
    const payload = await response.json() as { ok: boolean; error: string };
    assert.equal(payload.ok, false);
    assert.equal(payload.error, "Target request failed.");
  } finally {
    await stopServer(proxyServer);
  }
});
