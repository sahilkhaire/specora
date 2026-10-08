import { describe, expect, it } from "vitest";
import { safeExternalHref } from "./safe-url";

describe("safeExternalHref", () => {
  it("allows http, https and mailto", () => {
    expect(safeExternalHref("https://example.com/terms")).toBe("https://example.com/terms");
    expect(safeExternalHref("mailto:api@example.com")).toBe("mailto:api@example.com");
  });

  it("rejects script and data URLs", () => {
    expect(safeExternalHref("javascript:alert(1)")).toBeUndefined();
    expect(safeExternalHref(" JaVaScRiPt:alert(1)")).toBeUndefined();
    expect(safeExternalHref("data:text/html,<script>alert(1)</script>")).toBeUndefined();
    expect(safeExternalHref(42)).toBeUndefined();
  });
});
