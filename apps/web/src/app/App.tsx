import { useEffect, useMemo, useRef, useState } from "react";
import {
  detectDefaultServerUrl,
  extractOperations,
  filterOperations,
  getUsedSchemaDetailsForOperation,
  groupOperationsByTags,
  parseSpecText,
  operationKey
} from "@/features/spec/spec-utils";
import {
  applyVariables,
  buildRequestUrl,
  buildAuthHeaders,
  mapTryoutSendError,
  safeParseRecord,
  scaffoldFromParameters
} from "@/features/tryout/tryout-utils";
import type { AuthConfig, AuthType } from "@/features/tryout/tryout-utils";
import { useEnvironments } from "@/features/environments/use-environments";
import { EnvPanel } from "@/features/environments/EnvPanel";
import { SettingsView } from "@/features/settings/SettingsView";
import { WorkflowsView } from "@/features/workflows/WorkflowsView";
import { useWorkflows } from "@/features/workflows/use-workflows";
import { WorkspaceSelector } from "@/features/workspaces/WorkspaceSelector";
import { useWorkspaces } from "@/features/workspaces/use-workspaces";

type ActiveSection = "endpoints" | "workflows";

type LoadMode = "url" | "upload" | "paste";
type ThemeMode = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "specora-theme-mode";

function getStoredThemeMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "system";
  }

  const value = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }

  return "system";
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") {
    return "light";
  }

  if (typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function prettyBody(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function statusTone(status: string): string {
  const code = Number(status);
  if (code >= 200 && code < 300) return "status-2xx";
  if (code >= 300 && code < 400) return "status-3xx";
  if (code >= 400 && code < 500) return "status-4xx";
  if (code >= 500) return "status-5xx";
  return "";
}

function methodTone(method: string): string {
  if (method === "GET") {
    return "method-badge method-get";
  }

  if (method === "POST") {
    return "method-badge method-post";
  }

  if (method === "DELETE") {
    return "method-badge method-delete";
  }

  return "method-badge method-default";
}

export function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredThemeMode());
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => {
    const initialMode = getStoredThemeMode();
    return initialMode === "system" ? getSystemTheme() : initialMode;
  });
  const [loadMode, setLoadMode] = useState<LoadMode>("url");
  const [rawInput, setRawInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [spec, setSpec] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string>("");
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [selectedOperationKey, setSelectedOperationKey] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [pathParamsInput, setPathParamsInput] = useState("{}");
  const [queryParamsInput, setQueryParamsInput] = useState("{}");
  const [headersInput, setHeadersInput] = useState("{}");
  const [requestBody, setRequestBody] = useState("");
  const [useProxy, setUseProxy] = useState(false);
  const [proxyUrl, setProxyUrl] = useState("http://localhost:8787/proxy");
  const [requestStatus, setRequestStatus] = useState<string>("");
  const [requestResponse, setRequestResponse] = useState("");
  const [requestHeaders, setRequestHeaders] = useState<Record<string, string>>({});
  const [requestTiming, setRequestTiming] = useState<number | null>(null);
  const [requestError, setRequestError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [authType, setAuthType] = useState<AuthType>("none");
  const [authValue, setAuthValue] = useState("");
  const [authKeyName, setAuthKeyName] = useState("X-API-Key");
  const [showSpecLoader, setShowSpecLoader] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const [isEnvPanelOpen, setIsEnvPanelOpen] = useState(false);
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());
  const [activeSection, setActiveSection] = useState<ActiveSection>("endpoints");
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (themeMode === "system") {
      if (typeof window.matchMedia !== "function") {
        setResolvedTheme("light");
        return;
      }

      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const update = () => setResolvedTheme(media.matches ? "dark" : "light");
      update();

      if (typeof media.addEventListener === "function") {
        media.addEventListener("change", update);
        return () => media.removeEventListener("change", update);
      }

      media.addListener(update);
      return () => media.removeListener(update);
    }

    setResolvedTheme(themeMode);
  }, [themeMode]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const root = document.documentElement;
    root.setAttribute("data-theme", resolvedTheme);
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const {
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    createWorkspace,
    updateWorkspaceSpec,
    renameWorkspace,
    deleteWorkspace,
    switchWorkspace,
  } = useWorkspaces();

  const {
    environments,
    activeEnvId,
    activeEnv,
    createEnvironment,
    updateEnvironment,
    deleteEnvironment,
    switchEnvironment,
  } = useEnvironments();

  const workflowsApi = useWorkflows(activeWorkspaceId ?? "");

  useEffect(() => {
    if (workspaces.length === 0) {
      createWorkspace("Default Workspace", "Primary workspace");
      return;
    }

    if (!activeWorkspaceId || !activeWorkspace) {
      switchWorkspace(workspaces[0].id);
    }
  }, [workspaces, activeWorkspaceId, activeWorkspace, createWorkspace, switchWorkspace]);

  useEffect(() => {
    if (!activeWorkspace) {
      setSpec(null);
      setRawInput("");
      setUrlInput("");
      setError("");
      return;
    }

    setSpec(activeWorkspace.spec);
    setSelectedOperationKey("");
    setError("");

    if (!activeWorkspace.specSource) {
      setRawInput("");
      setUrlInput("");
      return;
    }

    if (activeWorkspace.specSource.type === "url") {
      setUrlInput(activeWorkspace.specSource.value);
      setRawInput("");
      return;
    }

    setRawInput(activeWorkspace.specSource.value);
    setUrlInput("");
  }, [activeWorkspaceId, activeWorkspace]);

  const operations = useMemo(() => (spec ? extractOperations(spec) : []), [spec]);
  const filteredOperations = useMemo(() => filterOperations(operations, methodFilter, searchTerm), [operations, searchTerm, methodFilter]);

  const selectedOperation = useMemo(() => {
    if (!selectedOperationKey) {
      return filteredOperations[0] ?? null;
    }

    return filteredOperations.find((operation) => {
      return operation.key === selectedOperationKey;
    }) ?? filteredOperations[0] ?? null;
  }, [filteredOperations, selectedOperationKey]);

  const methods = useMemo(() => {
    const unique = new Set(operations.map((operation) => operation.method));
    return ["ALL", ...Array.from(unique).sort()];
  }, [operations]);

  const tagGroups = useMemo(() => groupOperationsByTags(filteredOperations), [filteredOperations]);
  const usedSchemaDetails = useMemo(() => {
    if (!spec || !selectedOperation) {
      return [];
    }

    return getUsedSchemaDetailsForOperation(spec, selectedOperation);
  }, [spec, selectedOperation]);

  // Auto-expand all tag groups when groups change (e.g. new spec loaded or filter applied).
  useEffect(() => {
    setExpandedTags(new Set(tagGroups.map((g) => g.tag)));
  }, [tagGroups.length]);

  function toggleTag(tag: string) {
    setExpandedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  }
  const info = (spec?.info as Record<string, unknown> | undefined) ?? {};
  const apiTitle = String(info.title ?? "No API loaded");
  const apiVersion = String(info.version ?? "—");
  const workflowAuth: AuthConfig = {
    type: authType,
    value: authValue,
    keyName: authKeyName,
  };

  // Auto-fill server URL and auth when the active environment switches.
  useEffect(() => {
    if (!activeEnv) return;
    if (activeEnv.baseUrl) setServerUrl(activeEnv.baseUrl);
    setAuthType(activeEnv.auth.type);
    setAuthValue(activeEnv.auth.value);
    setAuthKeyName(activeEnv.auth.keyName);
  // Only re-run when the active env ID changes, not on every field edit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEnvId]);

  // When the selected operation changes, auto-scaffold params from the spec definition.
  // We key on the stable string ID so typing in the search box doesn't reset manual edits.
  const selectedOpKey = selectedOperation ? operationKey(selectedOperation) : "";
  useEffect(() => {
    if (!selectedOperation) return;
    const { pathParams, queryParams, headers } = scaffoldFromParameters(selectedOperation.parameters);
    const fmt = (obj: Record<string, string>) =>
      Object.keys(obj).length > 0 ? JSON.stringify(obj, null, 2) : "{}";
    setPathParamsInput(fmt(pathParams));
    setQueryParamsInput(fmt(queryParams));
    setHeadersInput(fmt(headers));
  // selectedOperation object reference changes on every search keystroke even for the same op;
  // selectedOpKey is stable — only changes when a genuinely different operation is picked.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOpKey]);

  async function loadFromUrl() {
    const url = urlInput.trim();
    if (!url) {
      setError("Please provide a URL.");
      return;
    }

    setIsLoadingUrl(true);
    setError("");
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Unable to fetch spec (HTTP ${response.status})`);
      }

      const text = await response.text();
      const result = parseSpecText(text);
      if (!result.ok) {
        setSpec(null);
        setError(result.error);
        return;
      }

      setSpec(result.spec);
      setRawInput(text);
      setSelectedOperationKey("");
      setServerUrl(detectDefaultServerUrl(result.spec));
      if (activeWorkspace) {
        updateWorkspaceSpec(activeWorkspace.id, { type: "url", value: url }, result.spec);
      }
    } catch (fetchError) {
      setSpec(null);
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load URL");
    } finally {
      setIsLoadingUrl(false);
    }
  }

  function loadFromText() {
    const result = parseSpecText(rawInput);
    if (!result.ok) {
      setSpec(null);
      setError(result.error);
      return;
    }

    setError("");
    setSpec(result.spec);
    setSelectedOperationKey("");
    setServerUrl(detectDefaultServerUrl(result.spec));
    if (activeWorkspace) {
      updateWorkspaceSpec(activeWorkspace.id, { type: "text", value: rawInput }, result.spec);
    }
  }

  async function loadFromFile(file: File | null) {
    if (!file) {
      return;
    }

    const text = await file.text();
    setRawInput(text);
    const result = parseSpecText(text);
    if (!result.ok) {
      setSpec(null);
      setError(result.error);
      return;
    }

    setError("");
    setSpec(result.spec);
    setSelectedOperationKey("");
    setServerUrl(detectDefaultServerUrl(result.spec));
    if (activeWorkspace) {
      updateWorkspaceSpec(activeWorkspace.id, { type: "file", value: text, fileName: file.name }, result.spec);
    }
  }

  async function sendRequest() {
    if (!selectedOperation) {
      setRequestError("No operation selected.");
      return;
    }

    const parsedPath = safeParseRecord(pathParamsInput);
    if (!parsedPath.ok) {
      setRequestError(`Path params error: ${parsedPath.error}`);
      return;
    }

    const parsedQuery = safeParseRecord(queryParamsInput);
    if (!parsedQuery.ok) {
      setRequestError(`Query params error: ${parsedQuery.error}`);
      return;
    }

    const parsedHeaders = safeParseRecord(headersInput);
    if (!parsedHeaders.ok) {
      setRequestError(`Headers error: ${parsedHeaders.error}`);
      return;
    }

    if (!serverUrl.trim()) {
      setRequestError("Server URL is required for try-out.");
      return;
    }

    setRequestError("");
    setIsSending(true);
    setRequestStatus("");
    setRequestResponse("");
    setRequestHeaders({});

    // Resolve {{varName}} tokens from the active environment before building the request.
    const vars = activeEnv?.variables ?? {};
    const applyVars = (obj: Record<string, string>): Record<string, string> =>
      Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, applyVariables(v, vars)]));

    const targetUrl = buildRequestUrl({
      baseUrl: applyVariables(serverUrl, vars),
      endpointPath: selectedOperation.path,
      pathParams: applyVars(parsedPath.data),
      queryParams: applyVars(parsedQuery.data),
    });

    const method = selectedOperation.method;
    const canSendBody = !["GET", "HEAD"].includes(method);
    const body = canSendBody && requestBody.trim() ? applyVariables(requestBody, vars) : undefined;
    const authCfg: AuthConfig = { type: authType, value: authValue, keyName: authKeyName };
    const mergedHeaders = applyVars({ ...parsedHeaders.data, ...buildAuthHeaders(authCfg) });
    const start = performance.now();

    try {
      if (useProxy) {
        const proxyResponse = await fetch(proxyUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            url: targetUrl,
            method,
            headers: mergedHeaders,
            body
          })
        });

        const payload = await proxyResponse.json() as {
          ok: boolean;
          status: number;
          headers: Record<string, string>;
          body: string;
          error?: string;
        };

        if (!proxyResponse.ok || !payload.ok) {
          throw new Error(payload.error ?? `Proxy request failed with HTTP ${proxyResponse.status}`);
        }

        setRequestStatus(`${payload.status}`);
        setRequestHeaders(payload.headers ?? {});
        setRequestResponse(prettyBody(payload.body || ""));
      } else {
        const response = await fetch(targetUrl, {
          method,
          headers: mergedHeaders,
          body
        });

        const responseText = await response.text();
        setRequestStatus(`${response.status}`);
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => { headers[key] = value; });
        setRequestHeaders(headers);
        setRequestResponse(prettyBody(responseText));
      }

      setRequestTiming(Math.round(performance.now() - start));
    } catch (sendError) {
      setRequestError(mapTryoutSendError(sendError, useProxy));
      setRequestTiming(Math.round(performance.now() - start));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="top-nav">
        <div className="brand-row">
          <h1>Specora</h1>
          <span className="brand-caption">Modern OpenAPI documentation experience</span>
        </div>

        <div className="top-actions">
          <WorkspaceSelector
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspaceId}
            onSwitch={switchWorkspace}
            onCreate={(name, description) => {
              createWorkspace(name, description);
            }}
            onRename={renameWorkspace}
            onDelete={deleteWorkspace}
          />
        </div>
      </header>

      <div className="dashboard-layout">
        <aside className="side-nav">
          <div className="api-card">
            <p className="api-title">{apiTitle}</p>
            <p className="api-version">v{apiVersion}</p>
          </div>

          <nav className="side-links" aria-label="Sections">
            <button 
              type="button" 
              className={`side-link ${activeSection === "endpoints" ? "active" : ""}`}
              onClick={() => setActiveSection("endpoints")}
            >
              Endpoints
            </button>
            <button 
              type="button" 
              className={`side-link ${activeSection === "workflows" ? "active" : ""}`}
              onClick={() => setActiveSection("workflows")}
            >
              Workflows
            </button>
          </nav>

          <div className="side-nav-footer">
            <button
              type="button"
              className="side-footer-btn"
              onClick={() => {
                setShowSpecLoader(true);
                setLoadMode("url");
                setTimeout(() => urlInputRef.current?.focus(), 50);
              }}
            >
              Import Spec
            </button>
            <button
              type="button"
              className="side-footer-btn"
              onClick={() => setIsEnvPanelOpen(true)}
            >
              Environment
            </button>
            <button
              type="button"
              className="side-footer-btn"
              onClick={() => setShowSettings(true)}
            >
              Settings
            </button>
          </div>
        </aside>

        {activeSection === "endpoints" && (
          <>
            <section className="left-pane">
          <div className="filter-row">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by path, summary, or tag"
            />
            <select
              value={methodFilter}
              onChange={(event) => setMethodFilter(event.target.value)}
              className="method-select"
              aria-label="Filter method"
            >
              {methods.map((method) => (
                <option key={method} value={method}>{method}</option>
              ))}
            </select>
          </div>

          <div className="operation-list" role="list">
            {tagGroups.length > 0 ? tagGroups.map((group) => {
              const isOpen = expandedTags.has(group.tag);
              return (
                <div key={group.tag} className="tag-group">
                  <button
                    type="button"
                    className="tag-header"
                    aria-expanded={isOpen}
                    onClick={() => toggleTag(group.tag)}
                  >
                    <span className="tag-name">{group.tag}</span>
                    <span className="tag-count">{group.operations.length}</span>
                    <span className="tag-chevron" style={{ transform: isOpen ? "rotate(90deg)" : undefined }}>▶</span>
                  </button>
                  {isOpen ? (
                    <div className="tag-operations">
                      {group.operations.map((operation) => (
                        <button
                          key={operation.key}
                          className={`operation-row ${selectedOperation && selectedOperation.key === operation.key ? "active" : ""}`}
                          type="button"
                          onClick={() => setSelectedOperationKey(operation.key)}
                        >
                          <span className={methodTone(operation.method)}>{operation.method}</span>
                          <span className="op-path">{operation.path}</span>
                          <span className="op-summary">{operation.summary}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            }) : <p className="empty-message">No operations match your current filters.</p>}
          </div>
        </section>

        <section className="right-pane">
          <article className="detail-card">
            <div className="detail-head">
              <h2>Operation</h2>
            </div>

            {selectedOperation ? (
              <>
                <div className="detail-title">
                  <span className={methodTone(selectedOperation.method)}>{selectedOperation.method}</span>
                  <strong>{selectedOperation.path}</strong>
                </div>
                <p>{selectedOperation.summary}</p>
                {selectedOperation.description ? <p>{selectedOperation.description}</p> : null}
                <ul className="meta-list">
                  <li>Operation ID: {selectedOperation.operationId || "N/A"}</li>
                  <li>Tags: {selectedOperation.tags.length ? selectedOperation.tags.join(", ") : "None"}</li>
                  <li>Parameters: {selectedOperation.parameters.length}</li>
                  <li>Request Body: {selectedOperation.requestBody ? "Present" : "None"}</li>
                </ul>

                <div className="used-schemas-block">
                  <h3>Used Schemas ({usedSchemaDetails.length})</h3>
                  {usedSchemaDetails.length > 0 ? (
                    <div className="used-schemas-list">
                      {usedSchemaDetails.map((schema) => (
                        <details key={`${schema.source}:${schema.name}`} className="used-schema-item">
                          <summary className="used-schema-head">
                            <span className="used-schema-name">{schema.name}</span>
                            <span className="used-schema-head-right">
                              <span className="used-schema-count">{schema.propertyMeta.length} fields</span>
                              <span className="used-schema-kind">{schema.type}</span>
                              <span className="used-schema-kind">{schema.source}</span>
                            </span>
                          </summary>
                          <div className="used-schema-body">
                            {schema.description ? <p className="used-schema-desc">{schema.description}</p> : null}
                            {schema.propertyMeta.length > 0 ? (
                              <ul className="used-schema-fields-list">
                                {schema.propertyMeta.map((field) => (
                                  <li key={`${schema.name}:${field.name}`} className="used-schema-field-item">
                                    <span className="used-schema-field-name">{field.name}</span>
                                    <span className="used-schema-field-type">{field.type}</span>
                                    {field.required ? <span className="used-schema-required">required</span> : null}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="used-schema-fields">No fields declared.</p>
                            )}
                          </div>
                        </details>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-message">No schemas detected for this endpoint.</p>
                  )}
                </div>
              </>
            ) : (
              <p className="empty-message">No operation selected.</p>
            )}
          </article>

          <article className="detail-card">
            <div className="tryout-head">
              <h2>Try It Out</h2>
              <label className="inline-switch">
                <span>Local Proxy</span>
                <input
                  type="checkbox"
                  checked={useProxy}
                  onChange={(event) => setUseProxy(event.target.checked)}
                />
              </label>
            </div>

            <div className="stack">
              <label>
                <span>Server</span>
                <input
                  value={serverUrl}
                  onChange={(event) => setServerUrl(event.target.value)}
                  placeholder="https://api.example.com"
                />
              </label>
              {useProxy ? (
                <label>
                  <span>Proxy URL</span>
                  <input
                    value={proxyUrl}
                    onChange={(event) => setProxyUrl(event.target.value)}
                    placeholder="http://localhost:8787/proxy"
                  />
                </label>
              ) : null}
            </div>

            <details className="auth-section">
              <summary>Authentication</summary>
              <div className="auth-grid">
                <label>
                  <span>Type</span>
                  <select value={authType} onChange={(event) => setAuthType(event.target.value as AuthType)}>
                    <option value="none">None</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="basic">Basic (base64)</option>
                    <option value="api-key">API Key</option>
                  </select>
                </label>
                {authType !== "none" ? (
                  <>
                    {authType === "api-key" ? (
                      <label>
                        <span>Header Name</span>
                        <input
                          value={authKeyName}
                          onChange={(event) => setAuthKeyName(event.target.value)}
                          placeholder="X-API-Key"
                        />
                      </label>
                    ) : null}
                    <label className={authType === "api-key" ? "" : "auth-value-full"}>
                      <span>
                        {authType === "bearer" ? "Token" : authType === "basic" ? "Credentials (base64)" : "API Key Value"}
                      </span>
                      <input
                        type="password"
                        value={authValue}
                        onChange={(event) => setAuthValue(event.target.value)}
                        placeholder={authType === "bearer" ? "eyJ…" : authType === "basic" ? "dXNlcjpwYXNz" : "••••••"}
                      />
                    </label>
                  </>
                ) : null}
              </div>
            </details>

            <div className="tryout-grid">
              <label>
                <span>Path Params JSON</span>
                <textarea value={pathParamsInput} onChange={(event) => setPathParamsInput(event.target.value)} rows={3} />
              </label>
              <label>
                <span>Query Params JSON</span>
                <textarea value={queryParamsInput} onChange={(event) => setQueryParamsInput(event.target.value)} rows={3} />
              </label>
              <label>
                <span>Headers JSON</span>
                <textarea value={headersInput} onChange={(event) => setHeadersInput(event.target.value)} rows={3} />
              </label>
              <label>
                <span>Request Body</span>
                <textarea value={requestBody} onChange={(event) => setRequestBody(event.target.value)} rows={4} />
              </label>
            </div>

            <button type="button" onClick={sendRequest} disabled={!selectedOperation || isSending}>
              {isSending ? "Sending..." : "Send Request"}
            </button>

            {requestError ? <p className="error">{requestError}</p> : null}

            <div className="response-box">
              <div className="response-meta">
                {requestStatus ? (
                  <span className={`status-badge ${statusTone(requestStatus)}`}>{requestStatus}</span>
                ) : null}
                <span className="response-time">{requestTiming !== null ? `${requestTiming} ms` : ""}</span>
              </div>
              {Object.keys(requestHeaders).length > 0 ? (
                <details className="response-headers">
                  <summary>Response Headers ({Object.keys(requestHeaders).length})</summary>
                  <table>
                    <tbody>
                      {Object.entries(requestHeaders).map(([key, value]) => (
                        <tr key={key}>
                          <td>{key}</td>
                          <td>{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              ) : null}
              <pre>{requestResponse || "No response yet."}</pre>
            </div>
          </article>
        </section>
          </>
        )}

        {activeSection === "workflows" && (
          <WorkflowsView
            specLoaded={Boolean(spec)}
            operations={operations}
            serverUrl={serverUrl}
            useProxy={useProxy}
            proxyUrl={proxyUrl}
            activeEnv={activeEnv}
            auth={workflowAuth}
            workflowsApi={workflowsApi}
            onImportSpec={() => {
              setShowSpecLoader(true);
              setLoadMode("url");
              setTimeout(() => urlInputRef.current?.focus(), 50);
            }}
          />
        )}
      </div>

      {showSettings && (
        <div className="spec-loader-overlay" onClick={() => setShowSettings(false)}>
          <div
            className="spec-loader-panel settings-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="spec-loader-header">
              <h2>Settings</h2>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowSettings(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="spec-loader-content">
              <SettingsView
                spec={spec}
                useProxy={useProxy}
                proxyUrl={proxyUrl}
                themeMode={themeMode}
                resolvedTheme={resolvedTheme}
                onThemeModeChange={setThemeMode}
                onProxyChange={(use, url) => {
                  setUseProxy(use);
                  setProxyUrl(url);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {showSpecLoader && (
        <div className="spec-loader-overlay">
          <div className="spec-loader-panel">
            <div className="spec-loader-header">
              <h2>Import Specification</h2>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowSpecLoader(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="spec-loader-content">
              <article className="panel-card">
                <h3>Load Spec</h3>
                <div className="load-tabs" role="tablist" aria-label="Load mode">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={loadMode === "url"}
                    className={loadMode === "url" ? "active" : ""}
                    onClick={() => setLoadMode("url")}
                  >
                    URL
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={loadMode === "upload"}
                    className={loadMode === "upload" ? "active" : ""}
                    onClick={() => setLoadMode("upload")}
                  >
                    Upload
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={loadMode === "paste"}
                    className={loadMode === "paste" ? "active" : ""}
                    onClick={() => setLoadMode("paste")}
                  >
                    Paste
                  </button>
                </div>

                {loadMode === "url" ? (
                  <div className="stack">
                    <input
                      ref={urlInputRef}
                      value={urlInput}
                      onChange={(event) => setUrlInput(event.target.value)}
                      placeholder="https://example.com/openapi.json"
                    />
                    <button type="button" onClick={loadFromUrl} disabled={isLoadingUrl}>
                      {isLoadingUrl ? "Loading..." : "Load URL"}
                    </button>
                  </div>
                ) : null}

                {loadMode === "upload" ? (
                  <div className="stack">
                    <input
                      type="file"
                      accept=".json,.yaml,.yml"
                      onChange={(event) => void loadFromFile(event.target.files?.[0] ?? null)}
                    />
                  </div>
                ) : null}

                {loadMode === "paste" ? (
                  <div className="stack">
                    <textarea
                      value={rawInput}
                      onChange={(event) => setRawInput(event.target.value)}
                      placeholder="Paste OpenAPI JSON or YAML here"
                      rows={10}
                    />
                    <button type="button" onClick={loadFromText}>Parse Pasted Spec</button>
                  </div>
                ) : null}

                {error ? <p className="error">{error}</p> : null}
              </article>

              <article className="panel-card summary-card">
                <div className="summary-head">
                  <h3>API Summary</h3>
                  <span className="healthy-badge">HEALTHY</span>
                </div>
                {spec ? (
                  <>
                    <p><span>Title</span> {String(info.title ?? "Untitled API")}</p>
                    <p><span>Version</span> {String(info.version ?? "unknown")}</p>
                    <p><span>Operations</span> {operations.length}</p>
                    <p><span>Visible</span> {filteredOperations.length}</p>
                  </>
                ) : (
                  <p className="empty-message">No spec loaded yet.</p>
                )}
              </article>
            </div>
          </div>
        </div>
      )}

      <nav className="mobile-bottom-nav" aria-label="Mobile sections">
        <button 
          type="button" 
          className={activeSection === "endpoints" ? "active" : ""}
          onClick={() => setActiveSection("endpoints")}
        >
          Endpoints
        </button>
        <button 
          type="button" 
          className={activeSection === "workflows" ? "active" : ""}
          onClick={() => setActiveSection("workflows")}
        >
          Workflows
        </button>
      </nav>

      <EnvPanel
        isOpen={isEnvPanelOpen}
        onClose={() => setIsEnvPanelOpen(false)}
        environments={environments}
        activeEnvId={activeEnvId}
        onSwitch={switchEnvironment}
        onCreate={createEnvironment}
        onUpdate={updateEnvironment}
        onDelete={deleteEnvironment}
      />
    </div>
  );
}
