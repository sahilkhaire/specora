import { Hono } from "hono";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "../db/client.js";
import { requireUser } from "../auth/require-user.js";
import { autoVerifyCustomDomains, platformDocsDomain } from "../config.js";
import { badRequest, conflict, notFound } from "../http/errors.js";
import { optionalBoolean, optionalString, parseStoredJson, readJsonObject } from "../http/validate.js";
import { requireOwnedWorkspace } from "../services/workspaces.js";

type SiteRow = typeof schema.publishedSites.$inferSelect;

const HOSTING_TYPES = new Set(["platform_subdomain", "custom_domain"]);
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const RESERVED_SLUGS = new Set(["www", "api", "app", "admin", "docs", "mail", "static", "cdn", "embed"]);
const HOSTNAME_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

function normalizeSlug(raw: string): string {
  const slug = raw.trim().toLowerCase();
  if (!SLUG_PATTERN.test(slug)) {
    throw badRequest("Slug must be 1-63 lowercase letters, digits, or hyphens, and cannot start or end with a hyphen.");
  }
  if (RESERVED_SLUGS.has(slug)) {
    throw badRequest(`Slug '${slug}' is reserved.`);
  }
  return slug;
}

function normalizeCustomDomain(raw: string): string | null {
  const domain = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!domain) return null;
  if (!HOSTNAME_PATTERN.test(domain)) {
    throw badRequest("Custom domain must be a valid hostname, e.g. docs.example.com.");
  }
  const platform = platformDocsDomain();
  if (domain === platform || domain.endsWith(`.${platform}`)) {
    throw badRequest(`Use the slug field for ${platform} subdomains.`);
  }
  return domain;
}

function defaultSlug(workspaceId: string): string {
  const candidate = workspaceId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  return SLUG_PATTERN.test(candidate) && !RESERVED_SLUGS.has(candidate) ? candidate : `site-${crypto.randomUUID().slice(0, 8)}`;
}

function publicHostFor(hostingType: string, slug: string, customDomain: string | null): string {
  return hostingType === "custom_domain" && customDomain
    ? `https://${customDomain}`
    : `https://${slug}.${platformDocsDomain()}`;
}

function siteForWorkspace(workspaceId: string): SiteRow | undefined {
  return db.select().from(schema.publishedSites).where(eq(schema.publishedSites.workspaceId, workspaceId)).get();
}

export const publishRoutes = new Hono();

publishRoutes.get("/workspaces/:workspaceId/publish-settings", (c) => {
  const userId = requireUser(c);
  const workspace = requireOwnedWorkspace(userId, c.req.param("workspaceId"));
  return c.json({ site: siteForWorkspace(workspace.id) ?? null });
});

publishRoutes.put("/workspaces/:workspaceId/publish-settings", async (c) => {
  const userId = requireUser(c);
  const workspace = requireOwnedWorkspace(userId, c.req.param("workspaceId"));
  const body = await readJsonObject(c);
  const existing = siteForWorkspace(workspace.id);

  const slugInput = optionalString(body, "slug", 63);
  const slug = slugInput?.trim() ? normalizeSlug(slugInput) : (existing?.slug ?? defaultSlug(workspace.id));

  const hostingType = optionalString(body, "hostingType", 32) ?? existing?.hostingType ?? "platform_subdomain";
  if (!HOSTING_TYPES.has(hostingType)) {
    throw badRequest("Field 'hostingType' must be 'platform_subdomain' or 'custom_domain'.");
  }

  const domainInput = optionalString(body, "customDomain", 253);
  const customDomain = domainInput !== undefined ? normalizeCustomDomain(domainInput) : (existing?.customDomain ?? null);
  if (hostingType === "custom_domain" && !customDomain) {
    throw badRequest("A custom domain is required for custom domain hosting.");
  }

  const isPublished = optionalBoolean(body, "isPublished") ?? existing?.isPublished ?? false;

  const slugTaken = db
    .select({ id: schema.publishedSites.id })
    .from(schema.publishedSites)
    .where(and(eq(schema.publishedSites.slug, slug), ne(schema.publishedSites.workspaceId, workspace.id)))
    .get();
  if (slugTaken) {
    throw conflict(`Slug '${slug}' is already taken.`);
  }

  if (customDomain) {
    const domainTaken = db
      .select({ id: schema.publishedSites.id })
      .from(schema.publishedSites)
      .where(and(eq(schema.publishedSites.customDomain, customDomain), ne(schema.publishedSites.workspaceId, workspace.id)))
      .get();
    if (domainTaken) {
      throw conflict(`Domain '${customDomain}' is already in use.`);
    }
  }

  const domainChanged = customDomain !== (existing?.customDomain ?? null);
  const customDomainVerifiedAt = !customDomain
    ? null
    : !domainChanged && existing?.customDomainVerifiedAt
      ? existing.customDomainVerifiedAt
      : autoVerifyCustomDomains()
        ? new Date().toISOString()
        : null;

  const values = {
    slug,
    hostingType,
    publicHost: publicHostFor(hostingType, slug, customDomain),
    customDomain,
    customDomainVerifiedAt,
    isPublished,
  };

  if (existing) {
    db.update(schema.publishedSites).set(values).where(eq(schema.publishedSites.id, existing.id)).run();
  } else {
    db.insert(schema.publishedSites).values({ id: crypto.randomUUID(), workspaceId: workspace.id, ...values }).run();
  }

  return c.json({ site: siteForWorkspace(workspace.id) ?? null });
});

function resolveSiteForRequest(slugParam: string | undefined, hostHeader: string | undefined): SiteRow | undefined {
  if (slugParam) {
    const slug = slugParam.trim().toLowerCase();
    return SLUG_PATTERN.test(slug)
      ? db.select().from(schema.publishedSites).where(eq(schema.publishedSites.slug, slug)).get()
      : undefined;
  }

  const host = (hostHeader ?? "").trim().toLowerCase().replace(/:\d+$/, "");
  if (!host) return undefined;

  const platformSuffix = `.${platformDocsDomain()}`;
  if (host.endsWith(platformSuffix)) {
    const slug = host.slice(0, -platformSuffix.length);
    return SLUG_PATTERN.test(slug)
      ? db.select().from(schema.publishedSites).where(eq(schema.publishedSites.slug, slug)).get()
      : undefined;
  }

  const site = db.select().from(schema.publishedSites).where(eq(schema.publishedSites.customDomain, host)).get();
  // An unverified custom domain could be claimed by anyone; don't serve it.
  return site && (site.customDomainVerifiedAt || autoVerifyCustomDomains()) ? site : undefined;
}

/**
 * Public, unauthenticated. The docs page calls this cross-origin, so the API
 * sees its own Host header; the page passes its hostname as `?host=` instead.
 */
publishRoutes.get("/public/docs", (c) => {
  const site = resolveSiteForRequest(c.req.query("slug"), c.req.query("host") ?? c.req.header("host"));
  if (!site || !site.isPublished) {
    throw notFound("Published docs not found.");
  }

  const workspace = db
    .select({ specJson: schema.workspaces.specJson })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, site.workspaceId))
    .get();
  const spec = parseStoredJson<Record<string, unknown> | null>(workspace?.specJson, null);
  if (!spec) {
    throw notFound("Spec not available.");
  }

  c.header("Cache-Control", "public, max-age=60");
  return c.json({
    slug: site.slug,
    publicHost: site.publicHost,
    spec,
    info: (spec.info as Record<string, unknown> | undefined) ?? {},
  });
});
