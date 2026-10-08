import { describe, expect, it } from "vitest";
import { listServers, resolveServerUrl } from "./ServersView";

describe("listServers", () => {
  it("reads OpenAPI 3 servers", () => {
    expect(listServers({ servers: [{ url: "https://api.example.com", description: "prod" }] })).toEqual([
      { url: "https://api.example.com", description: "prod", variables: undefined }
    ]);
  });

  it("synthesizes servers from Swagger 2.0 host and schemes", () => {
    expect(listServers({ swagger: "2.0", host: "petstore.swagger.io", basePath: "/v2", schemes: ["https", "http"] }).map((s) => s.url)).toEqual([
      "https://petstore.swagger.io/v2",
      "http://petstore.swagger.io/v2"
    ]);
  });

  it("fills server variables with defaults", () => {
    expect(
      resolveServerUrl({ url: "https://{region}.api.example.com/{version}", variables: { region: { default: "eu" } } })
    ).toBe("https://eu.api.example.com/{version}");
  });
});
