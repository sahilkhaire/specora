import { randomBytes } from "node:crypto";
import { promises as dns } from "node:dns";
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

const CHALLENGE_PREFIX = "_specora-challenge";

type TxtResolver = (hostname: string) => Promise<string[][]>;
let resolveTxt: TxtResolver = (hostname) => dns.resolveTxt(hostname);

/** Test hook: replace DNS TXT lookups. */
export function setTxtResolver(resolver: TxtResolver | null): void {
  resolveTxt = resolver ?? ((hostname) => dns.resolveTxt(hostname));
}

/** Site row plus the DNS record the owner must publish to verify a custom domain. */
function siteToJson(site: SiteRow | undefined) {
  if (!site) return null;
  const { customDomainToken, ...rest } = site;
  return {
    ...rest,
    customDomainVerified: Boolean(site.customDomain && (site.customDomainVerifiedAt || autoVerifyCustomDomains())),
    domainVerification:
      site.customDomain && customDomainToken && !site.customDomainVerifiedAt
        ? { type: "TXT", name: `${CHALLENGE_PREFIX}.${site.customDomain}`, value: customDomainToken }
        : null,
  };
}

export const publishRoutes = new Hono();

publishRoutes.get("/workspaces/:workspaceId/publish-settings", (c) => {
  const userId = requireUser(c);
  const workspace = requireOwnedWorkspace(userId, c.req.param("workspaceId"));
  return c.json({ site: siteToJson(siteForWorkspace(workspace.id)) });
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

  const customDomainToken = !customDomain
    ? null
    : !domainChanged && existing?.customDomainToken
      ? existing.customDomainToken
      : `specora-verify=${randomBytes(16).toString("hex")}`;

  const values = {
    slug,
    hostingType,
    publicHost: publicHostFor(hostingType, slug, customDomain),
    customDomain,
    customDomainVerifiedAt,
    customDomainToken,
    isPublished,
  };

  if (existing) {
    db.update(schema.publishedSites).set(values).where(eq(schema.publishedSites.id, existing.id)).run();
  } else {
    db.insert(schema.publishedSites).values({ id: crypto.randomUUID(), workspaceId: workspace.id, ...values }).run();
  }

  return c.json({ site: siteToJson(siteForWorkspace(workspace.id)) });
});

/** Check the `_specora-challenge.<domain>` TXT record and mark the custom domain verified. */
publishRoutes.post("/workspaces/:workspaceId/publish-settings/verify-domain", async (c) => {
  const userId = requireUser(c);
  const workspace = requireOwnedWorkspace(userId, c.req.param("workspaceId"));
  const site = siteForWorkspace(workspace.id);
  if (!site?.customDomain || !site.customDomainToken) {
    throw badRequest("Set a custom domain before verifying it.");
  }
  if (site.customDomainVerifiedAt) {
    return c.json({ site: siteToJson(site) });
  }

  const recordName = `${CHALLENGE_PREFIX}.${site.customDomain}`;
  let records: string[][] = [];
  try {
    records = await resolveTxt(recordName);
  } catch {
    records = [];
  }
  // A TXT record may be split into several strings; compare the joined value.
  const found = records.some((chunks) => chunks.join("").trim() === site.customDomainToken);
  if (!found) {
    throw badRequest(`TXT record ${recordName} with value ${site.customDomainToken} was not found. DNS changes can take a few minutes.`);
  }

  db.update(schema.publishedSites)
    .set({ customDomainVerifiedAt: new Date().toISOString() })
    .where(eq(schema.publishedSites.id, site.id))
    .run();
  return c.json({ site: siteToJson(siteForWorkspace(workspace.id)) });
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
