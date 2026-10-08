import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db, schema } from "../src/db/client.js";
import { hashPassword, needsRehash, verifyPassword } from "../src/auth/password.js";
import { Client, freshApp } from "./helpers.js";

describe("passwords", () => {
  it("hashes with scrypt and verifies", async () => {
    const hash = await hashPassword("s3cret-password");
    assert.match(hash, /^scrypt\$/);
    assert.equal(await verifyPassword("s3cret-password", hash), true);
    assert.equal(await verifyPassword("wrong", hash), false);
    assert.equal(needsRehash(hash), false);
  });

  it("still verifies legacy sha256 hashes and flags them for rehash", async () => {
    const legacy = `abc:${createHash("sha256").update("abc:old-password").digest("hex")}`;
    assert.equal(await verifyPassword("old-password", legacy), true);
    assert.equal(needsRehash(legacy), true);
  });
});

describe("auth routes", () => {
  it("signs up, reads the session, and logs out server-side", async () => {
    const client = new Client(await freshApp());
    const signup = await client.signup("Dev@Example.com");
    assert.equal(signup.status, 201);
    assert.equal(signup.json.user.email, "dev@example.com");

    const me = await client.request("/auth/me");
    assert.equal(me.json.user.email, "dev@example.com");

    // Capture the cookie, log out, then replay it: the session must be gone server-side.
    const sessions = db.select().from(schema.sessions).all();
    assert.equal(sessions.length, 1);
    await client.request("/auth/logout", { method: "POST" });
    assert.equal(db.select().from(schema.sessions).all().length, 0);
  });

  it("stores only a hash of the session token", async () => {
    const app = await freshApp();
    const response = await app.request("/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://localhost:5173" },
      body: JSON.stringify({ email: "a@example.com", password: "long-enough-pw" }),
    });
    const token = response.headers.getSetCookie()[0]!.split(";")[0]!.split("=")[1]!;
    const stored = db.select().from(schema.sessions).get()!;
    assert.notEqual(stored.id, token);
    assert.equal(stored.id, createHash("sha256").update(token).digest("hex"));
  });

  it("validates email and password", async () => {
    const client = new Client(await freshApp());
    assert.equal((await client.request("/auth/signup", { method: "POST", body: { email: "nope", password: "long-enough" } })).status, 400);
    assert.equal((await client.request("/auth/signup", { method: "POST", body: { email: "a@b.co", password: "short" } })).status, 400);
  });

  it("rejects duplicate emails", async () => {
    const app = await freshApp();
    assert.equal((await new Client(app).signup("dup@example.com")).status, 201);
    assert.equal((await new Client(app).signup("DUP@example.com")).status, 409);
  });

  it("logs in and upgrades legacy password hashes", async () => {
    const app = await freshApp();
    db.insert(schema.users)
      .values({
        id: "legacy-user",
        email: "legacy@example.com",
        passwordHash: `abc:${createHash("sha256").update("abc:old-password").digest("hex")}`,
        createdAt: new Date().toISOString(),
      })
      .run();

    const client = new Client(app);
    const bad = await client.request("/auth/login", { method: "POST", body: { email: "legacy@example.com", password: "nope" } });
    assert.equal(bad.status, 401);

    const ok = await client.request("/auth/login", { method: "POST", body: { email: "legacy@example.com", password: "old-password" } });
    assert.equal(ok.status, 200);
    const user = db.select().from(schema.users).where(eq(schema.users.id, "legacy-user")).get()!;
    assert.match(user.passwordHash, /^scrypt\$/);
  });

  it("marks cookies Secure when configured", async () => {
    const client = new Client(await freshApp({ COOKIE_SECURE: "true" }));
    const response = await client.signup("secure@example.com");
    const cookie = response.headers.get("set-cookie") ?? "";
    assert.match(cookie, /Secure/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
  });
});
