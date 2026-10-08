import { describe, expect, it } from "vitest";
import { publishedDocsQuery } from "./load-spec";

describe("publishedDocsQuery", () => {
  it("prefers an explicit slug", () => {
    expect(publishedDocsQuery({ search: "?slug=acme", hostname: "docs.acme.com" })).toBe("slug=acme");
  });

  it("derives the slug from a platform subdomain", () => {
    expect(publishedDocsQuery({ search: "", hostname: "acme.docs.varcore.dev" })).toBe("slug=acme");
  });

  it("falls back to the hostname for custom domains", () => {
    expect(publishedDocsQuery({ search: "", hostname: "docs.acme.com" })).toBe("host=docs.acme.com");
  });
});
