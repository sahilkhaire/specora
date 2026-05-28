import { useEffect, useState } from "react";
import { deploymentConfig } from "@/config/deployment";
import { apiFetch } from "@/data/api-client";

interface PublishedSite {
  slug: string;
  hostingType: string;
  publicHost: string | null;
  customDomain: string | null;
  isPublished: boolean;
}

interface PublishSettingsProps {
  workspaceId: string;
  onClose: () => void;
}

export function PublishSettings({ workspaceId, onClose }: PublishSettingsProps) {
  const [slug, setSlug] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [hostingType, setHostingType] = useState("platform_subdomain");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!deploymentConfig.apiBaseUrl) return;
    void apiFetch<{ site: PublishedSite | null }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/publish-settings`
    )
      .then((data) => {
        if (!data.site) return;
        setSlug(data.site.slug);
        setCustomDomain(data.site.customDomain ?? "");
        setIsPublished(data.site.isPublished);
        setHostingType(data.site.hostingType);
      })
      .catch(() => {
        /* guest mode — no API */
      });
  }, [workspaceId]);

  async function save() {
    if (!deploymentConfig.apiBaseUrl) {
      setError("Publishing requires API (signed-in SaaS mode).");
      return;
    }

    setError("");
    try {
      await apiFetch(`/workspaces/${encodeURIComponent(workspaceId)}/publish-settings`, {
        method: "PUT",
        body: JSON.stringify({
          slug,
          customDomain: customDomain || undefined,
          isPublished,
          hostingType,
          publicHost: customDomain
            ? `https://${customDomain}`
            : `https://${slug}.specora.doc`,
        }),
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    }
  }

  const previewUrl = customDomain
    ? `https://${customDomain}`
    : slug
      ? `https://${slug}.specora.doc`
      : "";

  return (
    <div className="spec-loader-overlay" onClick={onClose}>
      <div className="spec-loader-panel" onClick={(e) => e.stopPropagation()}>
        <div className="spec-loader-header">
          <h2>Publish documentation</h2>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="spec-loader-content">
          <p className="text-muted">
            Host read-only API docs on a subdomain or custom domain. Workflows and try-out stay in the full app.
          </p>
          <label>
            <span>Slug (specora.doc)</span>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="acme-api" />
          </label>
          <label>
            <span>Custom domain (optional)</span>
            <input
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder="docs.example.com"
            />
          </label>
          <label>
            <span>Hosting</span>
            <select value={hostingType} onChange={(e) => setHostingType(e.target.value)}>
              <option value="platform_subdomain">specora.doc subdomain</option>
              <option value="custom_domain">Custom domain</option>
            </select>
          </label>
          <label className="inline-switch">
            <span>Published</span>
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
            />
          </label>
          {previewUrl ? <p className="text-muted">Docs URL: {previewUrl}</p> : null}
          {error ? <p className="error">{error}</p> : null}
          {saved ? <p className="healthy-badge">Saved</p> : null}
          <button type="button" onClick={() => void save()}>
            Save publish settings
          </button>
        </div>
      </div>
    </div>
  );
}
