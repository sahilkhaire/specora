import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceSelector } from "./WorkspaceSelector";

const workspaces = [
  {
    id: "ws-1",
    name: "Default Workspace",
    description: "Main",
    specSource: null,
    spec: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "ws-2",
    name: "Payments",
    description: "Payments APIs",
    specSource: null,
    spec: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

describe("WorkspaceSelector", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renames a workspace with valid input", () => {
    const onRename = vi.fn();

    render(
      <WorkspaceSelector
        workspaces={workspaces}
        activeWorkspaceId="ws-1"
        onSwitch={vi.fn()}
        onCreate={vi.fn()}
        onRename={onRename}
        onDelete={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Default Workspace/i }));
    fireEvent.click(screen.getAllByRole("button", { name: "Rename" })[0]);

    fireEvent.change(screen.getByLabelText("Workspace Name *"), {
      target: { value: "Platform" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onRename).toHaveBeenCalledWith("ws-1", "Platform", "Main");
  });

  it("blocks renaming when the name is duplicate", () => {
    const onRename = vi.fn();

    render(
      <WorkspaceSelector
        workspaces={workspaces}
        activeWorkspaceId="ws-1"
        onSwitch={vi.fn()}
        onCreate={vi.fn()}
        onRename={onRename}
        onDelete={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Default Workspace/i }));
    fireEvent.click(screen.getAllByRole("button", { name: "Rename" })[0]);

    fireEvent.change(screen.getByLabelText("Workspace Name *"), {
      target: { value: "Payments" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Workspace name must be unique.")).toBeInTheDocument();
    expect(onRename).not.toHaveBeenCalled();
  });
});
