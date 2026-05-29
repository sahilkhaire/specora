import { describe, expect, it } from "vitest";
import {
  buildRequestUrl,
  extractPathParamNames,
  mergeParamRecord,
  pathWithColonParams,
  resolveDisplayRequestUrl,
  resolveRequestUrl,
  scaffoldFromOperation,
  scaffoldFromParameters
} from "./tryout-utils";

describe("scaffoldFromOperation", () => {
  it("includes path template placeholders not listed in parameters", () => {
    const scaffold = scaffoldFromOperation({
      path: "/users/{userId}/posts/{postId}",
      parameters: [
        {
          name: "userId",
          in: "path",
          schema: { type: "string", example: "abc" }
        }
      ]
    });

    expect(scaffold.pathParams).toEqual({
      userId: "abc",
      postId: ""
    });
  });

  it("fills query defaults from schema metadata", () => {
    const scaffold = scaffoldFromOperation({
      path: "/items",
      parameters: [
        {
          name: "page",
          in: "query",
          schema: { type: "integer", default: 1 }
        },
        {
          name: "active",
          in: "query",
          schema: { type: "boolean" }
        }
      ]
    });

    expect(scaffold.queryParams).toEqual({
      page: "1",
      active: "false"
    });
  });
});

describe("mergeParamRecord", () => {
  it("keeps user values and adds missing scaffold keys", () => {
    const merged = mergeParamRecord({ userId: "42" }, { userId: "1", page: "0" });
    expect(merged).toEqual({ userId: "42", page: "0" });
  });
});

describe("resolveRequestUrl", () => {
  it("appends enabled query params to the resolved URL", () => {
    expect(
      resolveRequestUrl({
        serverUrl: "https://api.example.com",
        endpointPath: "/items",
        pathParams: {},
        queryParams: { page: "2", limit: "10" }
      })
    ).toBe("https://api.example.com/items?page=2&limit=10");
  });

  it("omits disabled query params when not included in the record", () => {
    expect(
      resolveRequestUrl({
        serverUrl: "https://api.example.com",
        endpointPath: "/items",
        queryParams: { page: "1" }
      })
    ).toBe("https://api.example.com/items?page=1");
  });

  it("includes enabled query params with empty values", () => {
    expect(
      buildRequestUrl({
        baseUrl: "https://api.example.com",
        endpointPath: "/search",
        pathParams: {},
        queryParams: { q: "" }
      })
    ).toBe("https://api.example.com/search?q=");
  });

  it("merges query params into absolute request URLs", () => {
    expect(
      resolveRequestUrl({
        serverUrl: "",
        endpointPath: "https://api.example.com/users/1",
        queryParams: { include: "pets" }
      })
    ).toBe("https://api.example.com/users/1?include=pets");
  });
});

describe("resolveDisplayRequestUrl", () => {
  it("shows path params as :name and query params as values", () => {
    expect(
      resolveDisplayRequestUrl({
        serverUrl: "https://api.example.com",
        endpointPath: "/campaigns/{id}",
        queryParams: { page: "2", limit: "10" }
      })
    ).toBe("https://api.example.com/campaigns/:id?page=2&limit=10");
  });

  it("converts OpenAPI braces to colon placeholders", () => {
    expect(pathWithColonParams("/users/{userId}/posts/{postId}")).toBe(
      "/users/:userId/posts/:postId"
    );
  });
});

describe("extractPathParamNames", () => {
  it("extracts brace placeholders in order", () => {
    expect(extractPathParamNames("/pets/{petId}/photos/{photoId}")).toEqual(["petId", "photoId"]);
  });
});

describe("scaffoldFromParameters", () => {
  it("routes params by location", () => {
    const scaffold = scaffoldFromParameters([
      { name: "id", in: "path", schema: { type: "string" } },
      { name: "q", in: "query", schema: { type: "string", enum: ["a", "b"] } },
      { name: "X-Trace", in: "header", schema: { type: "string", example: "trace-1" } }
    ]);

    expect(scaffold.pathParams.id).toBe("");
    expect(scaffold.queryParams.q).toBe("a");
    expect(scaffold.headers["X-Trace"]).toBe("trace-1");
  });
});
