import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CollectionSidebar } from "./CollectionSidebar";

const baseProps = {
  nodes: [
    {
      id: "node-1",
      kind: "request" as const,
      name: "List pets",
      parentId: null,
      requestId: "req-1",
      sortOrder: 0,
    },
  ],
  requests: [
    {
      id: "req-1",
      name: "List pets",
      method: "GET",
      url: "/pets",
      source: "openapi" as const,
      operationKey: "get:/pets",
      pathParams: {},
      queryParams: {},
      headers: {},
      body: { mode: "none" as const, content: "" },
      authType: "none" as const,
      authValue: "",
      authKeyName: "X-API-Key",
      authSource: "env" as const,
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  selectedRequestId: "req-1",
  onSelectRequest: vi.fn(),
  onNewRequest: vi.fn(),
  onImportPostman: vi.fn(),
};

describe("CollectionSidebar", () => {
  it("shows collection action buttons by default", () => {
    render(<CollectionSidebar {...baseProps} />);
    expect(screen.getByRole("button", { name: "New request" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import" })).toBeInTheDocument();
  });

  it("hides collection action buttons when showCollectionActions is false", () => {
    render(<CollectionSidebar {...baseProps} showCollectionActions={false} />);
    expect(screen.queryByRole("button", { name: "New request" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Import" })).not.toBeInTheDocument();
  });
});

describe("CollectionSidebar keyboard navigation", () => {
  const request = baseProps.requests[0]!;
  const props = {
    ...baseProps,
    nodes: [
      { id: "folder", kind: "folder" as const, name: "pets", parentId: null, sortOrder: 0 },
      { id: "n1", kind: "request" as const, name: "List pets", parentId: "folder", requestId: "r1", sortOrder: 0 },
      { id: "n2", kind: "request" as const, name: "Create pet", parentId: "folder", requestId: "r2", sortOrder: 1 },
    ],
    requests: [
      { ...request, id: "r1", name: "List pets" },
      { ...request, id: "r2", name: "Create pet", method: "POST" },
    ],
    selectedRequestId: "r1",
  };

  it("is a single tab stop and moves with the arrow keys", async () => {
    render(<CollectionSidebar {...props} />);
    const listPets = screen.getByRole("button", { name: /List pets/ });
    const createPet = screen.getByRole("button", { name: /Create pet/ });
    expect(listPets).toHaveAttribute("tabindex", "0");
    expect(createPet).toHaveAttribute("tabindex", "-1");

    listPets.focus();
    fireEvent.keyDown(listPets, { key: "ArrowDown" });
    await waitFor(() => expect(createPet).toHaveFocus());

    fireEvent.keyDown(createPet, { key: "ArrowLeft" });
    await waitFor(() => expect(screen.getByRole("button", { name: "pets" })).toHaveFocus());
  });
});
