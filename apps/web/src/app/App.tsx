import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearOperationKeyFromLocation,
  detectDefaultServerUrl,
  extractOperations,
  filterOperations,
  filterPublicOperations,
  findOperationByKey,
  getOperationKeyFromLocation,
  getUsedSchemaDetailsForOperation,
  groupOperationsByTags,
  parseSpecText,
  operationKey,
  setOperationKeyInLocation
} from "@/features/spec/spec-utils";
import { isEmbedSurface, isFullAppSurface } from "@/config/deployment";
import {
  applyVariables,
  buildRequestUrl,
  buildAuthHeaders,
  mapTryoutSendError,
  safeParseRecord,
  scaffoldFromParameters
} from "@/features/tryout/tryout-utils";
import type { AuthConfig, AuthType } from "@/features/tryout/tryout-utils";
import { TryOutPanel } from "@/features/tryout/TryOutPanel";
import { useEnvironments } from "@/features/environments/use-environments";
import { EnvPanel } from "@/features/environments/EnvPanel";
import { SettingsView } from "@/features/settings/SettingsView";
import { WorkspaceSelector } from "@/features/workspaces/WorkspaceSelector";
import { useWorkspaces } from "@/features/workspaces/use-workspaces";

declare global {
  interface Window {
    __SPECORA_EMBED__?: {
      surface?: string;
      specUrl?: string;
      mountPath?: string;
      publicFilter?: string;
      includeAll?: boolean;
    };
  }
}

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

  if (method === "PUT" || method === "PATCH") {
    return "method-badge method-put";
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
  const [selectedOperationKey, setSelectedOperationKey] = useState(
    () => getOperationKeyFromLocation() ?? ""
  );

  const selectOperation = useCallback((key: string) => {
    setSelectedOperationKey(key);
    if (key) {
      setOperationKeyInLocation(key);
    } else {
      clearOperationKeyFromLocation();
    }
  }, []);

  const clearSelectedOperation = useCallback(() => {
    setSelectedOperationKey("");
    clearOperationKeyFromLocation({ replace: true });
  }, []);

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
  const specPromptDismissedRef = useRef<Set<string>>(new Set());
  const prevWorkspaceIdRef = useRef("");
  const [isEnvPanelOpen, setIsEnvPanelOpen] = useState(false);
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const showTryOut = !isEmbedSurface();
  const showImportSpec = isFullAppSurface() && !window.__SPECORA_EMBED__?.specUrl;

  useEffect(() => {
    const specUrl = window.__SPECORA_EMBED__?.specUrl;
    if (!specUrl) {
      return;
    }

    void (async () => {
      try {
        const response = await fetch(specUrl);
        if (!response.ok) {
          throw new Error(`Unable to load spec (HTTP ${response.status})`);
        }
        const text = await response.text();
        const result = parseSpecText(text);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setSpec(result.spec);
        setServerUrl(detectDefaultServerUrl(result.spec));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load embedded spec");
      }
    })();
  }, []);

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
    hydrated: workspacesHydrated,
    createWorkspace,
    updateWorkspaceSpec,
    renameWorkspace,
    deleteWorkspace,
    switchWorkspace,
  } = useWorkspaces();

  const needsSpecImport =
    isFullAppSurface() && showImportSpec && Boolean(activeWorkspace) && !activeWorkspace?.spec;

  function closeSpecLoader() {
    if (needsSpecImport && activeWorkspace) {
      specPromptDismissedRef.current.add(activeWorkspace.id);
    }
    setShowSpecLoader(false);
  }

  function onSpecImportSuccess() {
    setShowSpecLoader(false);
    if (activeWorkspace) {
      specPromptDismissedRef.current.delete(activeWorkspace.id);
    }
  }

  useEffect(() => {
    if (!isFullAppSurface() || !showImportSpec || !workspacesHydrated || !activeWorkspace) {
      return;
    }

    if (activeWorkspace.spec) {
      setShowSpecLoader(false);
      return;
    }

    if (specPromptDismissedRef.current.has(activeWorkspace.id)) {
      return;
    }

    setShowSpecLoader(true);
    setLoadMode("url");
    setError("");
    const timer = window.setTimeout(() => urlInputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [workspacesHydrated, activeWorkspaceId, activeWorkspace?.spec]);

  const {
    environments,
    activeEnvId,
    activeEnv,
    createEnvironment,
    updateEnvironment,
    deleteEnvironment,
    switchEnvironment,
  } = useEnvironments();

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
      prevWorkspaceIdRef.current = "";
      setSpec(null);
      setRawInput("");
      setUrlInput("");
      setError("");
      return;
    }

    const previousWorkspaceId = prevWorkspaceIdRef.current;
    const workspaceChanged = previousWorkspaceId !== activeWorkspace.id;
    prevWorkspaceIdRef.current = activeWorkspace.id;

    if (activeWorkspace.spec) {
      setSpec(activeWorkspace.spec);
    } else if (workspaceChanged) {
      setSpec(null);
    }

    if (workspaceChanged && previousWorkspaceId !== "") {
      clearSelectedOperation();
    }
    setError("");

    if (!activeWorkspace.specSource) {
      if (workspaceChanged) {
        setRawInput("");
        setUrlInput("");
      }
      return;
    }

    if (activeWorkspace.specSource.type === "url") {
      setUrlInput(activeWorkspace.specSource.value);
      setRawInput("");
      return;
    }

    setRawInput(activeWorkspace.specSource.value);
    setUrlInput("");
  }, [activeWorkspaceId, activeWorkspace, clearSelectedOperation]);

  const operations = useMemo(() => {
    if (!spec) return [];
    const all = extractOperations(spec);
    if (isEmbedSurface() && !window.__SPECORA_EMBED__?.includeAll) {
      return filterPublicOperations(all, spec);
    }
    return all;
  }, [spec]);
  const filteredOperations = useMemo(() => filterOperations(operations, methodFilter, searchTerm), [operations, searchTerm, methodFilter]);

  const selectedOperation = useMemo(() => {
    if (!operations.length) {
      return null;
    }

    if (selectedOperationKey) {
      const match = findOperationByKey(operations, selectedOperationKey);
      if (match) {
        return match;
      }
    }

    return filteredOperations[0] ?? operations[0] ?? null;
  }, [operations, filteredOperations, selectedOperationKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onPopState = () => {
      setSelectedOperationKey(getOperationKeyFromLocation() ?? "");
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const methods = useMemo(() => {
    const unique = new Set(operations.map((operation) => operation.method));
    return ["ALL", ...Array.from(unique).sort()];
  }, [operations]);

  const tagGroups = useMemo(() => groupOperationsByTags(filteredOperations), [filteredOperations]);

  useEffect(() => {
    if (tagGroups.length === 0) {
      return;
    }
    setExpandedTags(new Set(tagGroups.map((group) => group.tag)));
  }, [tagGroups]);
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
      clearSelectedOperation();
      setServerUrl(detectDefaultServerUrl(result.spec));
      const workspaceId = activeWorkspace?.id ?? activeWorkspaceId;
      if (workspaceId) {
        updateWorkspaceSpec(workspaceId, { type: "url", value: url }, result.spec);
      }
      onSpecImportSuccess();
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
    clearSelectedOperation();
    setServerUrl(detectDefaultServerUrl(result.spec));
    const workspaceId = activeWorkspace?.id ?? activeWorkspaceId;
    if (workspaceId) {
      updateWorkspaceSpec(workspaceId, { type: "text", value: rawInput }, result.spec);
    }
    onSpecImportSuccess();
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
    clearSelectedOperation();
    setServerUrl(detectDefaultServerUrl(result.spec));
    const workspaceId = activeWorkspace?.id ?? activeWorkspaceId;
    if (workspaceId) {
      updateWorkspaceSpec(workspaceId, { type: "file", value: text, fileName: file.name }, result.spec);
    }
    onSpecImportSuccess();
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
      <div className="app-body">
        <aside className="side-rail" aria-label="Main navigation">
          <div className="side-rail-brand">
            <span className="side-rail-logo" aria-hidden="true">S</span>
            <div className="side-rail-brand-text">
              <h1 className="side-rail-product">Specora</h1>
              <p className="side-rail-tagline">Browse and try API endpoints</p>
            </div>
          </div>

          {isFullAppSurface() ? (
            <div className="side-rail-workspace">
              <p className="side-rail-section-label">Workspace</p>
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
          ) : null}

          <div className="side-rail-tools">
            <p className="side-rail-section-label">Tools</p>
            {showImportSpec ? (
              <button
                type="button"
                className="side-tool-btn"
                onClick={() => {
                  setShowSpecLoader(true);
                  setLoadMode("url");
                  setTimeout(() => urlInputRef.current?.focus(), 50);
                }}
              >
                <span className="side-nav-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 3v12m0 0l4-4m-4 4l-4-4M4 19h16" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="side-nav-label">Import spec</span>
              </button>
            ) : null}
            <button
              type="button"
              className="side-tool-btn"
              onClick={() => setIsEnvPanelOpen(true)}
            >
              <span className="side-nav-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 7h16M4 12h10M4 17h7" strokeLinecap="round" />
                </svg>
              </span>
              <span className="side-nav-label">Environment</span>
            </button>
            <button
              type="button"
              className="side-tool-btn"
              onClick={() => setShowSettings(true)}
            >
              <span className="side-nav-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 1 1 0 4h-.09c-.66 0-1.25.4-1.51 1z" />
                </svg>
              </span>
              <span className="side-nav-label">Settings</span>
            </button>
          </div>
        </aside>

        <main className="main-panel">
          <div className="dashboard-layout">
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
                          onClick={() => selectOperation(operation.key)}
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
            }) : (
              <p className="empty-message">
                {spec
                  ? "No operations match your current filters."
                  : isFullAppSurface()
                    ? "Import an OpenAPI spec to explore endpoints."
                    : "No operations available."}
              </p>
            )}
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

          {showTryOut ? (
            <TryOutPanel
              selectedOperation={selectedOperation}
              serverUrl={serverUrl}
              onServerUrlChange={setServerUrl}
              useProxy={useProxy}
              onUseProxyChange={setUseProxy}
              proxyUrl={proxyUrl}
              onProxyUrlChange={setProxyUrl}
              pathParamsInput={pathParamsInput}
              onPathParamsChange={setPathParamsInput}
              queryParamsInput={queryParamsInput}
              onQueryParamsChange={setQueryParamsInput}
              headersInput={headersInput}
              onHeadersChange={setHeadersInput}
              requestBody={requestBody}
              onRequestBodyChange={setRequestBody}
              authType={authType}
              onAuthTypeChange={setAuthType}
              authValue={authValue}
              onAuthValueChange={setAuthValue}
              authKeyName={authKeyName}
              onAuthKeyNameChange={setAuthKeyName}
              activeEnv={activeEnv}
              isSending={isSending}
              onSend={() => void sendRequest()}
              requestError={requestError}
              requestStatus={requestStatus}
              requestTiming={requestTiming}
              requestHeaders={requestHeaders}
              requestResponse={requestResponse}
            />
          ) : null}
        </section>
          </div>
        </main>
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
        <div
          className={`spec-loader-overlay${needsSpecImport ? " spec-loader-overlay--required" : ""}`}
          onClick={needsSpecImport ? undefined : closeSpecLoader}
        >
          <div
            className="spec-loader-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="spec-loader-header">
              <div>
                <h2>{needsSpecImport ? "Add your API specification" : "Import Specification"}</h2>
                {needsSpecImport ? (
                  <p className="spec-loader-lead">
                    Load an OpenAPI or Swagger file to get started. It is saved to this workspace for next time.
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={closeSpecLoader}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="spec-loader-content">
              <article className="panel-card">
                <h3>Load spec</h3>
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
