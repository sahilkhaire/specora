import { useState } from "react";
import { deploymentConfig } from "@/config/deployment";
import { useDataContext } from "@/data/DataProvider";
import { exportGuestData } from "@/data/guest-export";
import { login, logout, migrateGuest, signup } from "@/data/remote-stores";

export function AuthPanel() {
  const { user, authLoading, refreshAuth } = useDataContext();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!deploymentConfig.enableSaasAuth || !deploymentConfig.apiBaseUrl) {
    return null;
  }

  if (authLoading) {
    return <span className="auth-status">…</span>;
  }

  if (user) {
    return (
      <div className="auth-panel">
        <span className="auth-email">{user.email}</span>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => void logout().then(() => refreshAuth())}
        >
          Sign out
        </button>
      </div>
    );
  }

  async function handleSubmit() {
    setError("");
    setBusy(true);
    try {
      if (mode === "signup") {
        await signup(email, password);
        const shouldMigrate = window.confirm(
          "Import workspaces and settings from this browser into your new account?"
        );
        if (shouldMigrate) {
          const payload = await exportGuestData();
          await migrateGuest(payload);
        }
      } else {
        await login(email, password);
      }
      await refreshAuth();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="auth-panel">
        <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
          Sign in
        </button>
        <button
          type="button"
          className="import-btn"
          onClick={() => {
            setMode("signup");
            setOpen(true);
          }}
        >
          Sign up
        </button>
      </div>
    );
  }

  return (
    <div className="auth-panel auth-panel-open">
      <div className="auth-form">
        <div className="load-tabs" role="tablist">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === "signup" ? "active" : ""}
            onClick={() => setMode("signup")}
          >
            Sign up
          </button>
        </div>
        <label>
          <span>Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        </label>
        <label>
          <span>Password</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            minLength={8}
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <div className="auth-form-actions">
          <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button type="button" disabled={busy} onClick={() => void handleSubmit()}>
            {busy ? "…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
