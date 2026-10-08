import { useEffect, useState } from "react";
import { apiFetch } from "@/data/api-client";
import { Button } from "@/shared/ui/Button";
import { Modal } from "@/shared/ui/Modal";

interface InstanceSettings {
  name: string;
  visibility: string;
  baseDomain: string | null;
}

interface AdminViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefills spec refresh with the workspace currently open. */
  activeWorkspaceId?: string;
}

/** Instance admin console (self-hosted). Requires SPECORA_ADMIN_PASSWORD on the API. */
export function AdminView({ open, onOpenChange, activeWorkspaceId = "" }: AdminViewProps) {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [visibility, setVisibility] = useState("private");
  const [baseDomain, setBaseDomain] = useState("");
  const [workspaceId, setWorkspaceId] = useState(activeWorkspaceId);
  const [specUrl, setSpecUrl] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setWorkspaceId(activeWorkspaceId);
    // An existing admin session skips the password prompt.
    apiFetch<InstanceSettings>("/admin/instance")
      .then((instance) => {
        setVisibility(instance.visibility);
        setBaseDomain(instance.baseDomain ?? "");
        setAuthenticated(true);
      })
      .catch(() => setAuthenticated(false));
  }, [open, activeWorkspaceId]);

  async function run(action: () => Promise<void>, successMessage: string) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await action();
      if (successMessage) setNotice(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  const login = () =>
    run(async () => {
      await apiFetch("/admin/login", { method: "POST", body: JSON.stringify({ password }) });
      const instance = await apiFetch<InstanceSettings>("/admin/instance");
      setVisibility(instance.visibility);
      setBaseDomain(instance.baseDomain ?? "");
      setPassword("");
      setAuthenticated(true);
    }, "");

  const logout = () =>
    run(async () => {
      await apiFetch("/admin/logout", { method: "POST" });
      setAuthenticated(false);
    }, "Signed out of admin.");

  const saveInstance = () =>
    run(async () => {
      await apiFetch("/admin/instance", { method: "PUT", body: JSON.stringify({ visibility, baseDomain }) });
    }, "Instance settings saved.");

  const refreshSpec = () =>
    run(async () => {
      await apiFetch("/admin/spec/refresh", { method: "POST", body: JSON.stringify({ workspaceId, specUrl }) });
    }, "Spec refreshed from URL. Reload the workspace to see it.");

  const messages = (
    <>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}
    </>
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Instance admin"
      description="Manage visibility, docs hosting, and specs for this deployment."
    >
      {!authenticated ? (
        <form
          className="ui-dialog-body"
          onSubmit={(event) => {
            event.preventDefault();
            void login();
          }}
        >
          <label>
            <span>Admin password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="SPECORA_ADMIN_PASSWORD"
              required
            />
          </label>
          {messages}
          <div className="ui-dialog-actions">
            <Button type="submit" disabled={busy}>
              Sign in as admin
            </Button>
          </div>
        </form>
      ) : (
        <>
          <form
            className="ui-dialog-body"
            onSubmit={(event) => {
              event.preventDefault();
              void saveInstance();
            }}
          >
            <label>
              <span>Visibility</span>
              <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
                <option value="private">Private (team only)</option>
                <option value="public">Public</option>
              </select>
            </label>
            <label>
              <span>Base domain</span>
              <input
                value={baseDomain}
                onChange={(e) => setBaseDomain(e.target.value)}
                placeholder="specora.internal.company.com"
              />
            </label>
            <div className="ui-dialog-actions">
              <Button type="submit" disabled={busy}>
                Save instance
              </Button>
            </div>
          </form>

          <form
            className="ui-dialog-body"
            onSubmit={(event) => {
              event.preventDefault();
              void refreshSpec();
            }}
          >
            <h3>Refresh spec from URL</h3>
            <label>
              <span>Workspace ID</span>
              <input value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} required />
            </label>
            <label>
              <span>OpenAPI URL</span>
              <input type="url" value={specUrl} onChange={(e) => setSpecUrl(e.target.value)} required />
            </label>
            {messages}
            <div className="ui-dialog-actions">
              <Button variant="ghost" onClick={() => void logout()} disabled={busy}>
                Sign out
              </Button>
              <Button type="submit" disabled={busy}>
                Refresh spec
              </Button>
            </div>
          </form>
        </>
      )}
    </Modal>
  );
}
