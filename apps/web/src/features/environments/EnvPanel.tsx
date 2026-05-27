import { useEffect, useState } from "react";
import type { Environment, EnvAuth } from "./env-types";
import type { AuthType } from "@/features/tryout/tryout-utils";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  environments: Environment[];
  activeEnvId: string;
  onSwitch: (id: string) => void;
  onCreate: (data: Omit<Environment, "id">) => void;
  onUpdate: (id: string, patch: Partial<Omit<Environment, "id">>) => void;
  onDelete: (id: string) => void;
}

export function EnvPanel({
  isOpen,
  onClose,
  environments,
  activeEnvId,
  onSwitch,
  onCreate,
  onUpdate,
  onDelete,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null); // null = new

  // Form state
  const [formName, setFormName] = useState("");
  const [formBaseUrl, setFormBaseUrl] = useState("");
  const [formAuthType, setFormAuthType] = useState<AuthType>("none");
  const [formAuthValue, setFormAuthValue] = useState("");
  const [formAuthKeyName, setFormAuthKeyName] = useState("X-API-Key");
  const [formVars, setFormVars] = useState<[string, string][]>([]);

  // Close on Escape; back-step from edit form on Escape too
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (isEditing) setIsEditing(false);
        else onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, isEditing, onClose]);

  function openNew() {
    setEditingId(null);
    setFormName("");
    setFormBaseUrl("");
    setFormAuthType("none");
    setFormAuthValue("");
    setFormAuthKeyName("X-API-Key");
    setFormVars([]);
    setIsEditing(true);
  }

  function openEdit(env: Environment) {
    setEditingId(env.id);
    setFormName(env.name);
    setFormBaseUrl(env.baseUrl);
    setFormAuthType(env.auth.type);
    setFormAuthValue(env.auth.value);
    setFormAuthKeyName(env.auth.keyName);
    setFormVars(Object.entries(env.variables));
    setIsEditing(true);
  }

  function save() {
    const name = formName.trim();
    if (!name) return;
    const auth: EnvAuth = {
      type: formAuthType,
      value: formAuthValue,
      keyName: formAuthKeyName.trim() || "X-API-Key",
    };
    const variables = Object.fromEntries(
      formVars.filter(([k]) => k.trim() !== "")
    );
    const data = { name, baseUrl: formBaseUrl.trim(), auth, variables };
    if (editingId === null) {
      onCreate(data);
    } else {
      onUpdate(editingId, data);
    }
    setIsEditing(false);
  }

  function updateVar(index: number, field: 0 | 1, value: string) {
    setFormVars((prev) => {
      const next = [...prev] as [string, string][];
      next[index] = field === 0
        ? [value, next[index]?.[1] ?? ""]
        : [next[index]?.[0] ?? "", value];
      return next;
    });
  }

  function removeVar(index: number) {
    setFormVars((prev) => prev.filter((_, i) => i !== index));
  }

  if (!isOpen) return null;

  return (
    <>
      <div className="env-overlay" onClick={onClose} />
      <aside className="env-panel" role="dialog" aria-modal="true" aria-label="Environments">

        {isEditing ? (
          /* ── Edit / Create form ─────────────────────────────── */
          <>
            <div className="env-panel-header">
              <button type="button" className="env-back-btn" onClick={() => setIsEditing(false)}>
                ← Back
              </button>
              <h2>{editingId === null ? "New Environment" : "Edit Environment"}</h2>
            </div>

            <div className="env-form">
              <label>
                <span>Name</span>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Production"
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                />
              </label>

              <label>
                <span>Base URL</span>
                <input
                  value={formBaseUrl}
                  onChange={(e) => setFormBaseUrl(e.target.value)}
                  placeholder="https://api.example.com"
                />
              </label>

              <fieldset className="env-auth-fieldset">
                <legend>Auth</legend>
                <label>
                  <span>Type</span>
                  <select
                    value={formAuthType}
                    onChange={(e) => setFormAuthType(e.target.value as AuthType)}
                  >
                    <option value="none">None</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="basic">Basic (base64)</option>
                    <option value="api-key">API Key</option>
                  </select>
                </label>

                {formAuthType !== "none" && (
                  <>
                    {formAuthType === "api-key" && (
                      <label>
                        <span>Header Name</span>
                        <input
                          value={formAuthKeyName}
                          onChange={(e) => setFormAuthKeyName(e.target.value)}
                          placeholder="X-API-Key"
                        />
                      </label>
                    )}
                    <label>
                      <span>
                        {formAuthType === "bearer"
                          ? "Token"
                          : formAuthType === "basic"
                          ? "Credentials (base64)"
                          : "Key Value"}
                      </span>
                      <input
                        type="password"
                        value={formAuthValue}
                        onChange={(e) => setFormAuthValue(e.target.value)}
                        placeholder="••••••••"
                      />
                    </label>
                  </>
                )}
              </fieldset>

              <fieldset className="env-vars-fieldset">
                <legend>Variables</legend>
                <p className="env-vars-hint">
                  Reference with <code>{"{{varName}}"}</code> in URLs, headers, and bodies.
                </p>
                <div className="env-vars-grid">
                  {formVars.map(([k, v], i) => (
                    // index-based key is acceptable here: list order never changes except append/delete
                    // eslint-disable-next-line react/no-array-index-key
                    <div key={i} className="env-var-row">
                      <input
                        value={k}
                        onChange={(e) => updateVar(i, 0, e.target.value)}
                        placeholder="variable"
                      />
                      <input
                        value={v}
                        onChange={(e) => updateVar(i, 1, e.target.value)}
                        placeholder="value"
                      />
                      <button type="button" className="env-var-del" onClick={() => removeVar(i)}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="env-add-var-btn"
                  onClick={() => setFormVars((prev) => [...prev, ["", ""]])}
                >
                  + Add Variable
                </button>
              </fieldset>

              <div className="env-form-actions">
                <button type="button" className="env-save-btn" onClick={save} disabled={!formName.trim()}>
                  Save
                </button>
                <button type="button" className="env-cancel-btn" onClick={() => setIsEditing(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </>
        ) : (
          /* ── Environment list ───────────────────────────────── */
          <>
            <div className="env-panel-header">
              <h2>Environments</h2>
              <button type="button" className="env-close-btn" onClick={onClose}>×</button>
            </div>

            <button type="button" className="env-new-btn" onClick={openNew}>
              + New Environment
            </button>

            <div className="env-list">
              {/* "No Environment" sentinel */}
              <div className={`env-item ${activeEnvId === "" ? "env-item-active" : ""}`}>
                <span className="env-dot" />
                <div className="env-item-info">
                  <span className="env-item-name">No Environment</span>
                </div>
                {activeEnvId !== "" && (
                  <div className="env-item-actions">
                    <button type="button" className="env-switch-btn" onClick={() => onSwitch("")}>
                      Use
                    </button>
                  </div>
                )}
                {activeEnvId === "" && <span className="env-active-label">active</span>}
              </div>

              {environments.map((env) => (
                <div key={env.id} className={`env-item ${activeEnvId === env.id ? "env-item-active" : ""}`}>
                  <span className={`env-dot ${activeEnvId === env.id ? "env-dot-on" : ""}`} />
                  <div className="env-item-info">
                    <span className="env-item-name">{env.name}</span>
                    {env.baseUrl && <span className="env-item-url">{env.baseUrl}</span>}
                    {Object.keys(env.variables).length > 0 && (
                      <span className="env-item-vars">
                        {Object.keys(env.variables).length} variable{Object.keys(env.variables).length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="env-item-actions">
                    {activeEnvId !== env.id && (
                      <button type="button" className="env-switch-btn" onClick={() => onSwitch(env.id)}>
                        Use
                      </button>
                    )}
                    {activeEnvId === env.id && <span className="env-active-label">active</span>}
                    <button type="button" className="env-edit-btn" onClick={() => openEdit(env)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="env-del-btn"
                      onClick={() => {
                        if (window.confirm(`Delete environment "${env.name}"?`)) {
                          onDelete(env.id);
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}

              {environments.length === 0 && (
                <p className="env-empty">
                  No environments yet. Create one to store your base URL, auth credentials, and variables.
                </p>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
