import { render, screen } from "@testing-library/react";
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
    expect(screen.getByRole("button", { name: "Import Postman" })).toBeInTheDocument();
  });

  it("hides collection action buttons when showCollectionActions is false", () => {
    render(<CollectionSidebar {...baseProps} showCollectionActions={false} />);
    expect(screen.queryByRole("button", { name: "New request" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Import Postman" })).not.toBeInTheDocument();
  });
});
