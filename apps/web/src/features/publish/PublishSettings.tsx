import { useEffect, useState } from "react";
import { deploymentConfig, platformPublishUrl } from "@/config/deployment";
import { apiFetch } from "@/data/api-client";
import { Button } from "@/shared/ui/Button";
import { Modal } from "@/shared/ui/Modal";

export interface PublishedSite {
  slug: string;
  hostingType: string;
  publicHost: string | null;
  customDomain: string | null;
  customDomainVerified: boolean;
  domainVerification: { type: string; name: string; value: string } | null;
  isPublished: boolean;
}

interface PublishSettingsProps {
  open: boolean;
  workspaceId: string;
  onOpenChange: (open: boolean) => void;
}

function settingsPath(workspaceId: string): string {
  return `/workspaces/${encodeURIComponent(workspaceId)}/publish-settings`;
}

export function PublishSettings({ open, workspaceId, onOpenChange }: PublishSettingsProps) {
  const [site, setSite] = useState<PublishedSite | null>(null);
  const [slug, setSlug] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [hostingType, setHostingType] = useState("platform_subdomain");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  function applySite(next: PublishedSite | null) {
    setSite(next);
    if (!next) return;
    setSlug(next.slug);
    setCustomDomain(next.customDomain ?? "");
    setIsPublished(next.isPublished);
    setHostingType(next.hostingType);
  }

  useEffect(() => {
    if (!open) return;
    setError("");
    setNotice("");
    apiFetch<{ site: PublishedSite | null }>(settingsPath(workspaceId))
      .then((data) => applySite(data.site))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load publish settings."));
  }, [open, workspaceId]);

  async function run(action: () => Promise<{ site: PublishedSite | null }>, successMessage: string) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      applySite((await action()).site);
      setNotice(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  function save() {
    void run(
      () =>
        apiFetch(settingsPath(workspaceId), {
          method: "PUT",
          body: JSON.stringify({ slug, customDomain, isPublished, hostingType })
        }),
      "Publish settings saved."
    );
  }

  function verify() {
    void run(
      () => apiFetch(`${settingsPath(workspaceId)}/verify-domain`, { method: "POST" }),
      "Domain verified."
    );
  }

  const previewUrl = site?.publicHost ?? (slug ? platformPublishUrl(slug) : "");

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Publish documentation"
      description="Host read-only API docs with try-out on a subdomain or your own domain."
    >
      <form
        className="ui-dialog-body"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <label>
          <span>Slug ({deploymentConfig.platformDocsDomain})</span>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="acme-api" />
        </label>
        <label>
          <span>Hosting</span>
          <select value={hostingType} onChange={(e) => setHostingType(e.target.value)}>
            <option value="platform_subdomain">{deploymentConfig.platformDocsDomain} subdomain</option>
            <option value="custom_domain">Custom domain</option>
          </select>
        </label>
        {hostingType === "custom_domain" ? (
          <label>
            <span>Custom domain</span>
            <input value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} placeholder="docs.example.com" />
          </label>
        ) : null}
        <label className="inline-switch">
          <span>Published</span>
          <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
        </label>

        {previewUrl ? <p className="text-muted">Docs URL: {previewUrl}</p> : null}

        {site?.domainVerification ? (
          <div className="panel-card">
            <p>
              <strong>Verify {site.customDomain}</strong>: add this DNS record, then select Verify domain.
            </p>
            <p className="text-muted">
              {site.domainVerification.type} <code>{site.domainVerification.name}</code>
            </p>
            <p className="text-muted">
              Value <code>{site.domainVerification.value}</code>
            </p>
            <Button variant="secondary" onClick={verify} disabled={busy}>
              Verify domain
            </Button>
          </div>
        ) : site?.customDomain && site.customDomainVerified ? (
          <p className="text-muted">{site.customDomain} is verified.</p>
        ) : null}

        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? <p role="status">{notice}</p> : null}

        <div className="ui-dialog-actions">
          <Button type="submit" disabled={busy}>
            Save publish settings
          </Button>
        </div>
      </form>
    </Modal>
  );
}
