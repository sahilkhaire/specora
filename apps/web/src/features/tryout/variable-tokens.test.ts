import { describe, expect, it } from "vitest";
import { hasVariableTokens, splitVariableTokens } from "./variable-tokens";

describe("variable-tokens", () => {
  it("splits text around variable tokens", () => {
    expect(splitVariableTokens("prefix-{{id}}-suffix")).toEqual([
      { type: "text", text: "prefix-" },
      { type: "var", text: "{{id}}", name: "id" },
      { type: "text", text: "-suffix" }
    ]);
  });

  it("detects variable tokens", () => {
    expect(hasVariableTokens("{{baseUrl}}/items")).toBe(true);
    expect(hasVariableTokens("/items")).toBe(false);
  });
});
