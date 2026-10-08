import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Client, freshApp, workspace } from "./helpers.js";

describe("workspace sync", () => {
  it("requires authentication", async () => {
    const client = new Client(await freshApp());
    assert.equal((await client.request("/workspaces")).status, 401);
  });

  it("keeps collection and history when the workspace list is saved again", async () => {
    const client = new Client(await freshApp());
    await client.signup("owner@example.com");

    await client.request("/workspaces", { method: "PUT", body: { workspaces: [workspace("ws1")] } });
    await client.request("/workspaces/ws1/collection", { method: "PUT", body: { collection: { version: 2, nodes: [1] } } });
    await client.request("/workspaces/ws1/history", { method: "PUT", body: { history: [{ id: "h1" }] } });

    // The web client re-saves the list (e.g. on rename) without collection/history fields.
    const renamed = { ...workspace("ws1"), name: "Renamed" };
    const saved = await client.request("/workspaces", { method: "PUT", body: { workspaces: [renamed] } });
    assert.equal(saved.json.workspaces[0].name, "Renamed");

    const collection = await client.request("/workspaces/ws1/collection");
    assert.deepEqual(collection.json.collection, { version: 2, nodes: [1] });
    const history = await client.request("/workspaces/ws1/history");
    assert.deepEqual(history.json.history, [{ id: "h1" }]);
  });

  it("deletes workspaces omitted from the list along with their workflows", async () => {
    const client = new Client(await freshApp());
    await client.signup("owner@example.com");
    await client.request("/workspaces", { method: "PUT", body: { workspaces: [workspace("a"), workspace("b")] } });
    await client.request("/workspaces/b/workflows", { method: "PUT", body: { workflows: [{ id: "wf1" }] } });

    const saved = await client.request("/workspaces", { method: "PUT", body: { workspaces: [workspace("a")] } });
    assert.deepEqual(saved.json.workspaces.map((w: { id: string }) => w.id), ["a"]);
    assert.equal((await client.request("/workspaces/b/workflows")).status, 404);
  });

  it("refuses to take over another user's workspace id and leaves both accounts intact", async () => {
    const app = await freshApp();
    const alice = new Client(app);
    const mallory = new Client(app);
    await alice.signup("alice@example.com");
    await mallory.signup("mallory@example.com");

    await alice.request("/workspaces", { method: "PUT", body: { workspaces: [workspace("alice-ws")] } });
    await mallory.request("/workspaces", { method: "PUT", body: { workspaces: [workspace("mallory-ws")] } });

    const attack = await mallory.request("/workspaces", {
      method: "PUT",
      body: { workspaces: [workspace("mallory-ws"), workspace("alice-ws", "pwned")] },
    });
    assert.equal(attack.status, 409);

    const aliceList = await alice.request("/workspaces");
    assert.equal(aliceList.json.workspaces[0].name, "Workspace alice-ws");
    const malloryList = await mallory.request("/workspaces");
    assert.deepEqual(malloryList.json.workspaces.map((w: { id: string }) => w.id), ["mallory-ws"]);
  });

  it("hides other users' workspace children", async () => {
    const app = await freshApp();
    const alice = new Client(app);
    const bob = new Client(app);
    await alice.signup("alice@example.com");
    await bob.signup("bob@example.com");
    await alice.request("/workspaces", { method: "PUT", body: { workspaces: [workspace("alice-ws")] } });

    for (const path of ["collection", "history", "workflows", "publish-settings"]) {
      assert.equal((await bob.request(`/workspaces/alice-ws/${path}`)).status, 404, path);
    }
  });

  it("guest migration cannot touch workflows of workspaces it does not own", async () => {
    const app = await freshApp();
    const alice = new Client(app);
    const mallory = new Client(app);
    await alice.signup("alice@example.com");
    await mallory.signup("mallory@example.com");
    await alice.request("/workspaces", { method: "PUT", body: { workspaces: [workspace("alice-ws")] } });
    await alice.request("/workspaces/alice-ws/workflows", { method: "PUT", body: { workflows: [{ id: "keep" }] } });

    const migrated = await mallory.request("/migrate-guest", {
      method: "POST",
      body: {
        workspaces: [workspace("mallory-ws")],
        environments: [{ id: "env1", name: "Dev" }],
        workflowBundles: [
          { workspaceId: "alice-ws", workflows: [] },
          { workspaceId: "mallory-ws", workflows: [{ id: "mine" }] },
        ],
      },
    });
    assert.equal(migrated.status, 200);

    const aliceWorkflows = await alice.request("/workspaces/alice-ws/workflows");
    assert.deepEqual(aliceWorkflows.json.workflows, [{ id: "keep" }]);
    const malloryWorkflows = await mallory.request("/workspaces/mallory-ws/workflows");
    assert.deepEqual(malloryWorkflows.json.workflows, [{ id: "mine" }]);
    const envs = await mallory.request("/environments");
    assert.equal(envs.json.environments[0].name, "Dev");
  });

  it("allows the same workflow id in different workspaces", async () => {
    const client = new Client(await freshApp());
    await client.signup("owner@example.com");
    await client.request("/workspaces", { method: "PUT", body: { workspaces: [workspace("a"), workspace("b")] } });
    assert.equal((await client.request("/workspaces/a/workflows", { method: "PUT", body: { workflows: [{ id: "wf" }] } })).status, 200);
    assert.equal((await client.request("/workspaces/b/workflows", { method: "PUT", body: { workflows: [{ id: "wf" }] } })).status, 200);
  });
});
