import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { getUserIdFromRequest } from "../auth/session.js";

export const publishRoutes = new Hono();

publishRoutes.get("/workspaces/:workspaceId/publish-settings", async (c) => {
  const userId = await getUserIdFromRequest(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const workspaceId = c.req.param("workspaceId");
  const owned = await db.select().from(schema.workspaces).where(eq(schema.workspaces.id, workspaceId)).limit(1);
  if (!owned[0] || owned[0].userId !== userId) {
    return c.json({ error: "Not found" }, 404);
  }

  const siteRows = await db
    .select()
    .from(schema.publishedSites)
    .where(eq(schema.publishedSites.workspaceId, workspaceId))
    .limit(1);

  return c.json({ site: siteRows[0] ?? null });
});

publishRoutes.put("/workspaces/:workspaceId/publish-settings", async (c) => {
  const userId = await getUserIdFromRequest(c);
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const workspaceId = c.req.param("workspaceId");
  const owned = await db.select().from(schema.workspaces).where(eq(schema.workspaces.id, workspaceId)).limit(1);
  if (!owned[0] || owned[0].userId !== userId) {
    return c.json({ error: "Not found" }, 404);
  }

  const body = await c.req.json<{
    slug?: string;
    hostingType?: string;
    publicHost?: string;
    customDomain?: string;
    isPublished?: boolean;
  }>();

  const slug = body.slug?.trim() ?? workspaceId.slice(0, 8);
  const existing = await db
    .select()
    .from(schema.publishedSites)
    .where(eq(schema.publishedSites.workspaceId, workspaceId))
    .limit(1);

  if (existing[0]) {
    await db
      .update(schema.publishedSites)
      .set({
        slug,
        hostingType: body.hostingType ?? existing[0].hostingType,
        publicHost: body.publicHost ?? existing[0].publicHost,
        customDomain: body.customDomain ?? existing[0].customDomain,
        isPublished: body.isPublished ?? existing[0].isPublished,
      })
      .where(eq(schema.publishedSites.workspaceId, workspaceId));
  } else {
    await db.insert(schema.publishedSites).values({
      id: crypto.randomUUID(),
      workspaceId,
      slug,
      hostingType: body.hostingType ?? "platform_subdomain",
      publicHost:
        body.publicHost ??
        `https://${slug}.${process.env.INSTANCE_BASE_DOMAIN ?? "docs.varcore.dev"}`,
      customDomain: body.customDomain ?? null,
      customDomainVerifiedAt: null,
      isPublished: body.isPublished ?? false,
    });
  }

  const siteRows = await db
    .select()
    .from(schema.publishedSites)
    .where(eq(schema.publishedSites.workspaceId, workspaceId))
    .limit(1);

  return c.json({ site: siteRows[0] ?? null });
});

publishRoutes.get("/public/docs", async (c) => {
  const host = c.req.header("host") ?? "";
  const slugParam = c.req.query("slug");

  let site;
  if (slugParam) {
    const rows = await db.select().from(schema.publishedSites).where(eq(schema.publishedSites.slug, slugParam)).limit(1);
    site = rows[0];
  } else {
    const rows = await db.select().from(schema.publishedSites);
    site = rows.find((s) => s.customDomain === host || s.publicHost?.includes(host));
  }

  if (!site || !site.isPublished) {
    return c.json({ error: "Published docs not found." }, 404);
  }

  const workspaceRows = await db
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, site.workspaceId))
    .limit(1);

  const workspace = workspaceRows[0];
  if (!workspace?.specJson) {
    return c.json({ error: "Spec not available." }, 404);
  }

  return c.json({
    slug: site.slug,
    publicHost: site.publicHost,
    spec: JSON.parse(workspace.specJson),
    info: JSON.parse(workspace.specJson).info ?? {},
  });
});
