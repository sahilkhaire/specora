import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();
vi.mock("@/data/api-client", () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }));

const { AdminView } = await import("./AdminView");

describe("AdminView", () => {
  afterEach(() => apiFetch.mockReset());

  it("prompts for the admin password, then shows instance settings", async () => {
    apiFetch.mockRejectedValueOnce(new Error("Admin auth required."));
    render(<AdminView open onOpenChange={() => undefined} activeWorkspaceId="ws1" />);

    const password = await screen.findByPlaceholderText("SPECORA_ADMIN_PASSWORD");
    fireEvent.change(password, { target: { value: "secret-pass" } });
    apiFetch.mockResolvedValueOnce({ ok: true });
    apiFetch.mockResolvedValueOnce({ name: "Default", visibility: "public", baseDomain: null });
    fireEvent.click(screen.getByRole("button", { name: "Sign in as admin" }));

    expect(await screen.findByDisplayValue("Public")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ws1")).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith("/admin/login", { method: "POST", body: JSON.stringify({ password: "secret-pass" }) });
  });

  it("shows the server error when sign-in fails", async () => {
    apiFetch.mockRejectedValueOnce(new Error("Admin auth required."));
    render(<AdminView open onOpenChange={() => undefined} />);
    fireEvent.change(await screen.findByPlaceholderText("SPECORA_ADMIN_PASSWORD"), { target: { value: "nope" } });
    apiFetch.mockRejectedValueOnce(new Error("Invalid admin credentials."));
    fireEvent.click(screen.getByRole("button", { name: "Sign in as admin" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid admin credentials.");
  });
});
