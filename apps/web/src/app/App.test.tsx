import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
});
