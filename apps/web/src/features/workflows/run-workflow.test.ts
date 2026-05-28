import { describe, expect, it, vi } from "vitest";
import { runWorkflow } from "./run-workflow";
import type { WorkflowStep } from "./workflow-types";

const baseConfig = {
  serverUrl: "https://api.example.com",
  useProxy: false,
  proxyUrl: "http://localhost:8787/proxy",
  auth: { type: "none" as const, value: "", keyName: "X-API-Key" },
  variables: {},
};

function makeStep(id: string, path: string): WorkflowStep {
  return {
    id,
    operationKey: `GET:${path}:`,
    method: "GET",
    path,
    summary: "test",
    pathParamsJson: "{}",
    queryParamsJson: "{}",
    headersJson: "{}",
    requestBody: "",
  };
}

describe("runWorkflow", () => {
  it("runs all steps in serial mode even after a failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("bad", { status: 500 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    vi.stubGlobal("fetch", fetchMock);

    const results = await runWorkflow(
      [makeStep("a", "/one"), makeStep("b", "/two")],
      "serial",
      baseConfig
    );

    expect(results).toHaveLength(2);
    expect(results[0]?.ok).toBe(false);
    expect(results[1]?.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.unstubAllGlobals();
  });

  it("stops on first failure in stop-on-error mode", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("bad", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    const results = await runWorkflow(
      [makeStep("a", "/one"), makeStep("b", "/two")],
      "stop-on-error",
      baseConfig
    );

    expect(results).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });
});
