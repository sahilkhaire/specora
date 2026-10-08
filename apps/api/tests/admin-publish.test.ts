import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Client, freshApp, workspace } from "./helpers.js";

describe("admin", () => {
  it("is disabled without SPECORA_ADMIN_PASSWORD", async () => {
    const client = new Client(await freshApp());
    const login = await client.request("/admin/login", { method: "POST", body: { password: "specora-admin" } });
    assert.equal(login.status, 404);
  });

  it("rejects a forged admin cookie", async () => {
    const client = new Client(await freshApp({ SPECORA_ADMIN_PASSWORD: "admin-secret-123" }));
    client.setCookie("specora_admin", "anything");
    assert.equal((await client.request("/admin/instance")).status, 401);
    const refresh = await client.request("/admin/spec/refresh", {
      method: "POST",
      body: { workspaceId: "x", specUrl: "http://169.254.169.254/latest/meta-data" },
    });
    assert.equal(refresh.status, 401);
  });

  it("logs in with the configured password and validates updates", async () => {
    const client = new Client(await freshApp({ SPECORA_ADMIN_PASSWORD: "admin-secret-123" }));
    assert.equal((await client.request("/admin/login", { method: "POST", body: { password: "wrong" } })).status, 401);
    assert.equal((await client.request("/admin/login", { method: "POST", body: { password: "admin-secret-123" } })).status, 200);

    const instance = await client.request("/admin/instance");
    assert.equal(instance.status, 200);
    assert.equal(instance.json.visibility, "private");

    assert.equal((await client.request("/admin/instance", { method: "PUT", body: { visibility: "bogus" } })).status, 400);
    assert.equal((await client.request("/admin/instance", { method: "PUT", body: { visibility: "public" } })).status, 200);
    assert.equal((await client.request("/admin/instance")).json.visibility, "public");
  });

  it("blocks spec refresh from private network addresses", async () => {
    const app = await freshApp({ SPECORA_ADMIN_PASSWORD: "admin-secret-123" });
    const owner = new Client(app);
    await owner.signup("owner@example.com");
    await owner.request("/workspaces", { method: "PUT", body: { workspaces: [workspace("ws1")] } });

    const admin = new Client(app);
    await admin.request("/admin/login", { method: "POST", body: { password: "admin-secret-123" } });
    const refresh = await admin.request("/admin/spec/refresh", {
      method: "POST",
      body: { workspaceId: "ws1", specUrl: "http://169.254.169.254/latest/meta-data" },
    });
    assert.equal(refresh.status, 400);
  });
});

describe("publishing", () => {
  async function ownerWithWorkspace(env: Record<string, string> = {}) {
    const app = await freshApp({ PLATFORM_DOCS_DOMAIN: "docs.example.dev", ...env });
    const owner = new Client(app);
    await owner.signup("owner@example.com");
    await owner.request("/workspaces", { method: "PUT", body: { workspaces: [workspace("ws1"), workspace("ws2")] } });
    return { app, owner };
  }

  it("validates slugs and computes the public host server-side", async () => {
    const { owner } = await ownerWithWorkspace();
    assert.equal((await owner.request("/workspaces/ws1/publish-settings", { method: "PUT", body: { slug: "Bad Slug!" } })).status, 400);
    assert.equal((await owner.request("/workspaces/ws1/publish-settings", { method: "PUT", body: { slug: "admin" } })).status, 400);

    const saved = await owner.request("/workspaces/ws1/publish-settings", {
      method: "PUT",
      body: { slug: "acme", isPublished: true, publicHost: "https://evil.example" },
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.json.site.publicHost, "https://acme.docs.example.dev");
  });

  it("rejects a slug already used by another workspace", async () => {
    const { owner } = await ownerWithWorkspace();
    await owner.request("/workspaces/ws1/publish-settings", { method: "PUT", body: { slug: "acme" } });
    const taken = await owner.request("/workspaces/ws2/publish-settings", { method: "PUT", body: { slug: "acme" } });
    assert.equal(taken.status, 409);
  });

  it("serves published docs by exact host or slug only", async () => {
    const { app, owner } = await ownerWithWorkspace();
    await owner.request("/workspaces/ws1/publish-settings", { method: "PUT", body: { slug: "acme", isPublished: true } });
    const anon = new Client(app);

    assert.equal((await anon.request("/public/docs?slug=acme")).status, 200);
    assert.equal((await anon.request("/public/docs", { headers: { host: "acme.docs.example.dev" } })).status, 200);
    assert.equal((await anon.request("/public/docs?host=acme.docs.example.dev")).status, 200);
    // Substring matches used to resolve to the first site.
    assert.equal((await anon.request("/public/docs", { headers: { host: "cme.docs.example.dev" } })).status, 404);
    assert.equal((await anon.request("/public/docs", { headers: { host: "docs.example.dev" } })).status, 404);
  });

  it("does not serve unpublished docs", async () => {
    const { app, owner } = await ownerWithWorkspace();
    await owner.request("/workspaces/ws1/publish-settings", { method: "PUT", body: { slug: "acme", isPublished: false } });
    assert.equal((await new Client(app).request("/public/docs?slug=acme")).status, 404);
  });

  it("serves custom domains only once verified", async () => {
    const { app, owner } = await ownerWithWorkspace();
    await owner.request("/workspaces/ws1/publish-settings", {
      method: "PUT",
      body: { slug: "acme", hostingType: "custom_domain", customDomain: "docs.acme.com", isPublished: true },
    });
    assert.equal((await new Client(app).request("/public/docs", { headers: { host: "docs.acme.com" } })).status, 404);

    const trusted = await ownerWithWorkspace({ PUBLISH_AUTO_VERIFY_CUSTOM_DOMAINS: "true" });
    await trusted.owner.request("/workspaces/ws1/publish-settings", {
      method: "PUT",
      body: { slug: "acme", hostingType: "custom_domain", customDomain: "docs.acme.com", isPublished: true },
    });
    assert.equal((await new Client(trusted.app).request("/public/docs", { headers: { host: "docs.acme.com" } })).status, 200);
  });
});
