import { useState } from "react";
import { deploymentConfig } from "@/config/deployment";
import { apiFetch } from "@/data/api-client";

export function AdminView() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [visibility, setVisibility] = useState("private");
  const [baseDomain, setBaseDomain] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [specUrl, setSpecUrl] = useState("");
  const [message, setMessage] = useState("");

  if (deploymentConfig.mode !== "enterprise" && deploymentConfig.mode !== "saas") {
    return (
      <div className="content-pane admin-pane">
        <article className="detail-card">
          <p className="empty-message">Admin console is available in SaaS or enterprise deployments.</p>
        </article>
      </div>
    );
  }

  async function login() {
    setMessage("");
    try {
      await apiFetch("/admin/login", {
        method: "POST",
        body: JSON.stringify({ password }),
      });
      setAuthenticated(true);
      const instance = await apiFetch<{
        visibility: string;
        baseDomain: string | null;
      }>("/admin/instance");
      setVisibility(instance.visibility);
      setBaseDomain(instance.baseDomain ?? "");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Login failed.");
    }
  }

  async function saveInstance() {
    setMessage("");
    try {
      await apiFetch("/admin/instance", {
        method: "PUT",
        body: JSON.stringify({ visibility, baseDomain }),
      });
      setMessage("Instance settings saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed.");
    }
  }

  async function refreshSpec() {
    setMessage("");
    try {
      await apiFetch("/admin/spec/refresh", {
        method: "POST",
        body: JSON.stringify({ workspaceId, specUrl }),
      });
      setMessage("Spec refreshed from URL.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Refresh failed.");
    }
  }

  if (!authenticated) {
    return (
      <div className="content-pane admin-pane">
        <article className="detail-card">
          <h2>Instance admin</h2>
          <p className="text-muted">Manage specs, visibility, and public doc hosting for this deployment.</p>
          <label>
            <span>Admin password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={deploymentConfig.mode === "enterprise" ? "From SPECORA_ADMIN_PASSWORD" : ""}
            />
          </label>
          {message ? <p className="error">{message}</p> : null}
          <button type="button" onClick={() => void login()}>
            Sign in as admin
          </button>
        </article>
      </div>
    );
  }

  return (
    <div className="content-pane admin-pane admin-pane-authenticated">
      <article className="detail-card">
        <h2>Instance settings</h2>
        <label>
          <span>Visibility</span>
          <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="private">Private (team only)</option>
            <option value="public">Public</option>
          </select>
        </label>
        <label>
          <span>Base domain (enterprise hosting)</span>
          <input
            value={baseDomain}
            onChange={(e) => setBaseDomain(e.target.value)}
            placeholder="specora.internal.company.com"
          />
        </label>
        <button type="button" onClick={() => void saveInstance()}>
          Save instance
        </button>
      </article>

      <article className="detail-card">
        <h2>Refresh spec from URL</h2>
        <label>
          <span>Workspace ID</span>
          <input value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} />
        </label>
        <label>
          <span>OpenAPI URL</span>
          <input value={specUrl} onChange={(e) => setSpecUrl(e.target.value)} />
        </label>
        <button type="button" onClick={() => void refreshSpec()}>
          Refresh spec
        </button>
        {message ? <p className="text-muted">{message}</p> : null}
      </article>
    </div>
  );
}
