import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

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
  });

  it("loads pasted spec and renders summary + operations", async () => {
    render(<App />);

    // Open the spec loader overlay
    fireEvent.click(screen.getByRole("button", { name: "Import Spec" }));

    fireEvent.click(screen.getByRole("tab", { name: "Paste" }));
    const textarea = screen.getByPlaceholderText("Paste OpenAPI JSON or YAML here");
    fireEvent.change(textarea, { target: { value: fixture } });

    fireEvent.click(screen.getByRole("button", { name: "Parse Pasted Spec" }));

    expect(await screen.findByText("UI Test API")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /List pets/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create order/i })).toBeInTheDocument();
  });

  it("filters operations and updates operation detail", async () => {
    render(<App />);

    // Open the spec loader overlay
    fireEvent.click(screen.getByRole("button", { name: "Import Spec" }));

    fireEvent.click(screen.getByRole("tab", { name: "Paste" }));
    const textarea = screen.getByPlaceholderText("Paste OpenAPI JSON or YAML here");
    fireEvent.change(textarea, { target: { value: fixture } });
    fireEvent.click(screen.getByRole("button", { name: "Parse Pasted Spec" }));

    const search = screen.getByPlaceholderText("Search by path, summary, or tag");
    fireEvent.change(search, { target: { value: "orders" } });

    expect(await screen.findByRole("button", { name: /Create order/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /List pets/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Create order/i }));
    expect(screen.getByText(/Operation ID:/)).toBeInTheDocument();
    expect(screen.getByText(/Request Body:/)).toBeInTheDocument();
  });

  it("supports workspace lifecycle create rename switch and delete", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<App />);

    expect(await screen.findByRole("button", { name: /Default Workspace/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "+" }));
    fireEvent.change(screen.getByLabelText("Workspace Name *"), {
      target: { value: "Billing Workspace" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

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

  it("shows actionable try-out message for direct network failures", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("Failed to fetch"));

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Import Spec" }));
    fireEvent.click(screen.getByRole("tab", { name: "Paste" }));
    fireEvent.change(screen.getByPlaceholderText("Paste OpenAPI JSON or YAML here"), {
      target: { value: fixture }
    });
    fireEvent.click(screen.getByRole("button", { name: "Parse Pasted Spec" }));

    fireEvent.click(await screen.findByRole("button", { name: /List pets/i }));
    fireEvent.click(screen.getByRole("button", { name: "Send Request" }));

    expect(await screen.findByText(
      "Network request failed (often CORS or connectivity). Next step: check API reachability or enable proxy mode."
    )).toBeInTheDocument();
  });
});
