import { describe, expect, it } from "vitest";
import { mapTryoutSendError } from "./tryout-utils";

describe("mapTryoutSendError", () => {
  it("maps timeout failures to a deterministic actionable message", () => {
    const message = mapTryoutSendError(new Error("Request timeout exceeded"), false);
    expect(message).toBe(
      "Request timed out. Next step: retry, verify the server URL, and check API/proxy responsiveness."
    );
  });

  it("maps authentication failures to token/credential action", () => {
    const message = mapTryoutSendError(new Error("Target returned HTTP 401"), true);
    expect(message).toBe(
      "Authentication failed (401/403). Next step: update auth credentials or token, then retry."
    );
  });

  it("maps direct network failures to connectivity or proxy action", () => {
    const message = mapTryoutSendError(new TypeError("Failed to fetch"), false);
    expect(message).toBe(
      "Network request failed (often CORS or connectivity). Next step: check API reachability or enable proxy mode."
    );
  });

  it("maps proxy connectivity failures to local proxy action", () => {
    const message = mapTryoutSendError(new TypeError("Failed to fetch"), true);
    expect(message).toBe(
      "Could not reach the local proxy. Next step: start `specora proxy` and confirm the proxy URL."
    );
  });

  it("falls back to preserving unknown errors", () => {
    const message = mapTryoutSendError(new Error("Unexpected downstream issue"), false);
    expect(message).toBe("Request failed: Unexpected downstream issue");
  });
});
