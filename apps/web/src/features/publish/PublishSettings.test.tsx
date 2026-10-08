import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();
vi.mock("@/data/api-client", () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }));

const { PublishSettings } = await import("./PublishSettings");

const pendingSite = {
  slug: "acme",
  hostingType: "custom_domain",
  publicHost: "https://docs.acme.com",
  customDomain: "docs.acme.com",
  customDomainVerified: false,
  domainVerification: { type: "TXT", name: "_specora-challenge.docs.acme.com", value: "specora-verify=abc" },
  isPublished: true
};

describe("PublishSettings", () => {
  afterEach(() => apiFetch.mockReset());

  it("shows the DNS challenge and verifies the domain", async () => {
    apiFetch.mockResolvedValueOnce({ site: pendingSite });
    render(<PublishSettings open workspaceId="ws1" onOpenChange={() => undefined} />);

    expect(await screen.findByText("_specora-challenge.docs.acme.com")).toBeInTheDocument();
    expect(screen.getByText("specora-verify=abc")).toBeInTheDocument();

    apiFetch.mockResolvedValueOnce({ site: { ...pendingSite, customDomainVerified: true, domainVerification: null } });
    fireEvent.click(screen.getByRole("button", { name: "Verify domain" }));

    expect(await screen.findByText("docs.acme.com is verified.")).toBeInTheDocument();
    expect(apiFetch).toHaveBeenLastCalledWith("/workspaces/ws1/publish-settings/verify-domain", { method: "POST" });
  });

  it("sends settings without a client-computed public host", async () => {
    apiFetch.mockResolvedValueOnce({ site: null });
    render(<PublishSettings open workspaceId="ws1" onOpenChange={() => undefined} />);
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText("acme-api"), { target: { value: "acme" } });
    apiFetch.mockResolvedValueOnce({ site: { ...pendingSite, hostingType: "platform_subdomain", customDomain: null, domainVerification: null } });
    fireEvent.click(screen.getByRole("button", { name: "Save publish settings" }));

    await screen.findByText("Publish settings saved.");
    const body = JSON.parse((apiFetch.mock.calls[1]![1] as { body: string }).body);
    expect(body).toMatchObject({ slug: "acme", hostingType: "platform_subdomain" });
    expect(body.publicHost).toBeUndefined();
  });
});
