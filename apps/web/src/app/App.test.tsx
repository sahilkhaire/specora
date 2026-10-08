import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataProvider } from "@/data/DataProvider";
import { App } from "./App";

function renderApp() {
  return render(
    <DataProvider>
      <App />
    </DataProvider>
  );
}

const fixture = `
openapi: 3.0.3
info:
  title: UI Test API
  version: 1.0.0
servers:
  - url: https://api.example.com
paths:
  /pets:
    get:
      summary: List pets
      tags: [pets]
      responses:
        "200":
          description: ok
  /orders:
    post:
      summary: Create order
      tags: [orders]
      operationId: createOrder
      responses:
        "201":
          description: created
`;

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    delete window.__SPECORA_EMBED__;
    window.history.replaceState(null, "", "/");
  });

  it("loads pasted spec and renders summary + operations", async () => {
    renderApp();
    expect(await screen.findByRole("button", { name: /Default Workspace/i, hidden: true })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /Add your API specification/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Paste" }));
    const textarea = screen.getByPlaceholderText("Paste OpenAPI JSON or YAML here");
    fireEvent.change(textarea, { target: { value: fixture } });

    fireEvent.click(screen.getByRole("button", { name: "Parse Pasted Spec" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /List pets/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Create order/i })).toBeInTheDocument();
  });

  it("filters operations and updates operation detail", async () => {
    renderApp();
    expect(await screen.findByRole("button", { name: /Default Workspace/i, hidden: true })).toBeInTheDocument();
    await screen.findByRole("heading", { name: /Add your API specification/i });

    fireEvent.click(screen.getByRole("tab", { name: "Paste" }));
    const textarea = screen.getByPlaceholderText("Paste OpenAPI JSON or YAML here");
    fireEvent.change(textarea, { target: { value: fixture } });
    fireEvent.click(screen.getByRole("button", { name: "Parse Pasted Spec" }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search requests…")).toBeInTheDocument();
    });

    const search = screen.getByPlaceholderText("Search requests…");
    fireEvent.change(search, { target: { value: "orders" } });

    expect(await screen.findByRole("button", { name: /Create order/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /List pets/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Create order/i }));
    expect(screen.getAllByText("Create order").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\/orders/).length).toBeGreaterThan(0);
  });

  it("supports workspace lifecycle create rename switch and delete", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderApp();

    expect(await screen.findByRole("button", { name: /Default Workspace/i, hidden: true })).toBeInTheDocument();
    await screen.findByRole("heading", { name: /Add your API specification/i });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    fireEvent.click(await screen.findByRole("button", { name: "Create workspace" }));
    fireEvent.change(screen.getByLabelText("Workspace Name *"), {
      target: { value: "Billing Workspace" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    // A new, empty workspace prompts for a spec; dismiss it.
    await screen.findByRole("heading", { name: /Add your API specification/i });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(await screen.findByRole("button", { name: /Billing Workspace/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Billing Workspace/i }));
    fireEvent.click(screen.getAllByRole("button", { name: "Rename" })[0]);
    fireEvent.change(screen.getByLabelText("Workspace Name *"), {
      target: { value: "Core Workspace" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("button", { name: /Billing Workspace/i })).toBeInTheDocument();

    let coreWorkspaceName = screen.queryByText("Core Workspace", { selector: ".workspace-item-name" });
    if (!coreWorkspaceName) {
      fireEvent.click(screen.getByRole("button", { name: /Billing Workspace/i }));
      coreWorkspaceName = await screen.findByText("Core Workspace", { selector: ".workspace-item-name" });
    }

    fireEvent.click(coreWorkspaceName);
    expect(await screen.findByRole("button", { name: /Core Workspace/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Core Workspace/i }));
    const billingWorkspaceName = screen.getByText("Billing Workspace", { selector: ".workspace-item-name" });
    const billingWorkspaceRow = billingWorkspaceName.closest(".workspace-item");
    const deleteButton = billingWorkspaceRow?.querySelector<HTMLButtonElement>(".workspace-delete-btn");
    expect(deleteButton).not.toBeNull();
    fireEvent.click(deleteButton as HTMLButtonElement);

    expect(screen.queryByText("Billing Workspace", { selector: ".workspace-item-name" })).not.toBeInTheDocument();
  });

  it("hides workspace and import actions in SDK embed context", async () => {
    const petstoreFixture = `
openapi: 3.0.3
info:
  title: UI Test API
  version: 1.0.0
paths:
  /pets:
    get:
      summary: List pets
      tags: [pets]
      responses:
        "200":
          description: ok
`;

    window.__SPECORA_EMBED__ = {
      specUrl: "/api-docs/openapi.json",
      downloadJsonUrl: "/api-docs/openapi.json",
      downloadYamlUrl: "/api-docs/openapi.yaml",
      includeAll: true,
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(petstoreFixture, { status: 200, headers: { "Content-Type": "application/yaml" } })
    );

    renderApp();

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Default Workspace/i })).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search requests…")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /List pets/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /New request/i })).not.toBeInTheDocument();

    expect(
      screen.queryByRole("heading", { name: /Add your API specification/i })
    ).not.toBeInTheDocument();
  });

  it("shows actionable try-out message for direct network failures", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("Failed to fetch"));

    renderApp();
    expect(await screen.findByRole("button", { name: /Default Workspace/i, hidden: true })).toBeInTheDocument();
    await screen.findByRole("heading", { name: /Add your API specification/i });
    fireEvent.click(screen.getByRole("tab", { name: "Paste" }));
    fireEvent.change(screen.getByPlaceholderText("Paste OpenAPI JSON or YAML here"), {
      target: { value: fixture }
    });
    fireEvent.click(screen.getByRole("button", { name: "Parse Pasted Spec" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /List pets/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /List pets/i }));
    fireEvent.click(screen.getAllByRole("button", { name: "Send" })[0]!);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Network request failed (often CORS or connectivity). Next step: check API reachability or enable local proxy mode (npx specora proxy --port 8787)."
    );
    expect(alert.querySelector("code")).toHaveTextContent("npx specora proxy --port 8787");
  });

  it("shows the load error when an embedded spec cannot be fetched", async () => {
    window.__SPECORA_EMBED__ = { specUrl: "/api-docs/openapi.json" };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 500 }));

    renderApp();

    expect(await screen.findByText("Couldn't load the API specification")).toBeInTheDocument();
    expect(screen.getByText("Unable to fetch spec (HTTP 500).")).toBeInTheDocument();
  });

  it("offers spec import after dismissing the first-run prompt", async () => {
    renderApp();
    await screen.findByRole("heading", { name: /Add your API specification/i });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    fireEvent.click(await screen.findByRole("button", { name: "Import OpenAPI spec" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("opens the request named by ?op= and keeps the URL in sync", async () => {
    window.__SPECORA_EMBED__ = { specUrl: "/api-docs/openapi.json", includeAll: true };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(fixture, { status: 200 }));
    window.history.replaceState(null, "", `/?op=${encodeURIComponent("POST:/orders:createOrder")}`);

    renderApp();

    await waitFor(() => {
      expect(screen.getByLabelText("Request URL")).toHaveValue("https://api.example.com/orders");
    });
    expect(new URLSearchParams(window.location.search).get("op")).toBe("POST:/orders:createOrder");

    fireEvent.click(screen.getByRole("button", { name: /List pets/i }));
    await waitFor(() => {
      expect(new URLSearchParams(window.location.search).get("op")).toBe("GET:/pets:");
    });
  });

  it("opens the API overview with Swagger servers from the header menu", async () => {
    window.__SPECORA_EMBED__ = { specUrl: "/api-docs/openapi.json", includeAll: true };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(fixture, { status: 200 }));
    renderApp();
    await screen.findByRole("button", { name: /List pets/i });

    fireEvent.keyDown(screen.getByRole("button", { name: "Menu" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: /API overview/i }));
    expect(await screen.findByRole("dialog", { name: "API overview" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Servers" }));
    expect(screen.getByText("https://api.example.com")).toBeInTheDocument();
  });

  it("sends the request with Ctrl+Enter", async () => {
    window.__SPECORA_EMBED__ = { specUrl: "/api-docs/openapi.json", includeAll: true };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(fixture, { status: 200 }));
    renderApp();
    await screen.findByRole("button", { name: /List pets/i });
    fireEvent.click(screen.getByRole("button", { name: /List pets/i }));
    fetchMock.mockResolvedValue(new Response("[]", { status: 200, headers: { "content-type": "application/json" } }));

    fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("https://api.example.com/pets", expect.objectContaining({ method: "GET" }));
    });
  });
});
