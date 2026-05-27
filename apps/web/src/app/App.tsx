import { useEffect, useMemo, useRef, useState } from "react";
import {
  detectDefaultServerUrl,
  extractOperations,
  filterOperations,
  parseSpecText,
  operationKey
} from "@/features/spec/spec-utils";
import { buildRequestUrl, buildAuthHeaders, safeParseRecord, scaffoldFromParameters } from "@/features/tryout/tryout-utils";
import type { AuthConfig, AuthType } from "@/features/tryout/tryout-utils";
import { useWorkspaces } from "@/features/workspaces/use-workspaces";
import { WorkspaceSelector } from "@/features/workspaces/WorkspaceSelector";
import { useEnvironments } from "@/features/environments/use-environments";
import { EnvPanel } from "@/features/environments/EnvPanel";

type LoadMode = "url" | "upload" | "paste";

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

  // Workspace management
  const {
    workspaces,
  
  // Get spec from active workspace
  const spec = activeWorkspace?.spec ?? null;
  
    activeWorkspace,
    createWorkspace,
    updateWorkspaceSpec,
    deleteWorkspace,
    switchWorkspace,
  } = useWorkspaces();

  // Environment management (workspace-scoped)
  const envHook = useEnvironments(activeWorkspaceId);

  // Create a default workspace if none exists
  useEffect(() => {
    if (workspaces.length === 0) {
      createWorkspace("Default Workspace", "Your first workspace");
    }
  }, [workspaces.length, createWorkspace]);

  return "method-badge method-default";
}

export function App() {
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

  const operations = useMemo(() => (spec ? extractOperations(spec) : []), [spec]);
  const filteredOperations = useMemo(() => filterOperations(operations, methodFilter, searchTerm), [operations, searchTerm, methodFilter]);

  const selectedOperation = useMemo(() => {
    if (!selectedOperationKey) {
      return filteredOperations[0] ?? null;
    }

    return filteredOperations.find((operation) => {
      return operationKey(operation) === selectedOperationKey;
    }) ?? filteredOperations[0] ?? null;
  }, [filteredOperations, selectedOperationKey]);

  const methods = useMemo(() => {
    const unique = new Set(operations.map((operation) => operation.method));
    return ["ALL", ...Array.from(unique).sort()];
  }, [operations]);
  const info = (spec?.info as Record<string, unknown> | undefined) ?? {};

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

    const targetUrl = buildRequestUrl({
      baseUrl: serverUrl,
      endpointPath: selectedOperation.path,
      pathParams: parsedPath.data,
      queryParams: parsedQuery.data
    });

    const method = selectedOperation.method;
    const canSendBody = !["GET", "HEAD"].includes(method);
    const body = canSendBody && requestBody.trim() ? requestBody : undefined;
    const authCfg: AuthConfig = { type: authType, value: authValue, keyName: authKeyName };
    const mergedHeaders = { ...parsedHeaders.data, ...buildAuthHeaders(authCfg) };
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
      setRequestError(sendError instanceof Error ? sendError.message : "Failed to send request");
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

        <nav className="top-links" aria-label="Primary">
          <button type="button" className="top-link active">Documentation</button>
          <button type="button" className="top-link">Changelog</button>
          <button type="button" className="top-link">API Status</button>
        </nav>

        <div className="top-actions">
          <button
            type="button"
            className="import-btn"
            onClick={() => {
              setShowSpecLoader(!showSpecLoader);
              if (!showSpecLoader) {
                setLoadMode("url");
                setTimeout(() => urlInputRef.current?.focus(), 50);
              }
            }}
          >
            {showSpecLoader ? "Close" : "Import Spec"}
          </button>
        </div>
      </header>

      <div className="dashboard-layout">
        <aside className="side-nav">
          <div className="api-card">
            <p className="api-title">Core API</p>
            <p className="api-version">v1.2.4-beta</p>
          </div>

          <nav className="side-links" aria-label="Sections">
            <button type="button" className="side-link active">Endpoints</button>
            <button type="button" className="side-link">Schemas</button>
            <button type="button" className="side-link">Security</button>
            <button type="button" className="side-link">Servers</button>
            <button type="button" className="side-link">Settings</button>
          </nav>
        </aside>

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
            {filteredOperations.length > 0 ? filteredOperations.map((operation) => (
              <button
                key={operationKey(operation)}
                className={`operation-row ${selectedOperation && operationKey(selectedOperation) === operationKey(operation) ? "active" : ""}`}
                type="button"
                onClick={() => setSelectedOperationKey(operationKey(operation))}
              >
                <span className={methodTone(operation.method)}>{operation.method}</span>
                <span className="op-path">{operation.path}</span>
                <span className="op-summary">{operation.summary}</span>
              </button>
            )) : <p className="empty-message">No operations match your current filters.</p>}
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
      </div>

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
        <button type="button" className="active">Endpoints</button>
        <button type="button">Schemas</button>
        <button type="button">Servers</button>
        <button type="button">Settings</button>
      </nav>
    </div>
  );
}
