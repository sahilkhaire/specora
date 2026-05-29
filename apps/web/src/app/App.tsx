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
import {
  deploymentConfig,
  getSpecoraEmbedConfig,
  isEmbedSurface,
  isFullAppSurface,
  isSdkEmbeddedContext,
  showImportSpec as canImportSpec
} from "@/config/deployment";
import {
  applyVariables,
  resolveRequestUrl,
  buildAuthHeaders,
  mapTryoutSendError,
  prettyResponseBody,
  safeParseRecord,
  scaffoldFromOperation
} from "@/features/tryout/tryout-utils";
import { parseParamRowsToRecord, serializeParamRecord } from "@/features/tryout/param-rows";
import { authFieldsForUi, authFromEnvironment, type AuthSource } from "@/features/tryout/auth-source";
import type { AuthType } from "@/features/tryout/tryout-utils";
import { TryOutPanel } from "@/features/tryout/TryOutPanel";
import { useEnvironments } from "@/features/environments/use-environments";
import { EnvPanel } from "@/features/environments/EnvPanel";
import { SettingsView } from "@/features/settings/SettingsView";
import { useWorkspaces } from "@/features/workspaces/use-workspaces";
import { ApiClientWorkbench } from "@/app/ApiClientWorkbench";
import { AppHeader } from "@/app/AppHeader";
import type { WorkbenchHeaderConfig } from "@/app/header-types";
import { fetchViaTryoutProxy } from "@/features/http/proxy-client";

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
  return prettyResponseBody(raw);
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
  const [specVersionLabel, setSpecVersionLabel] = useState("");
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
  const [useProxy, setUseProxy] = useState(deploymentConfig.tryoutUseProxy);
  const [proxyUrl, setProxyUrl] = useState(deploymentConfig.tryoutProxyUrl);
  const [requestStatus, setRequestStatus] = useState<string>("");
  const [requestResponse, setRequestResponse] = useState("");
  const [requestHeaders, setRequestHeaders] = useState<Record<string, string>>({});
  const [requestTiming, setRequestTiming] = useState<number | null>(null);
  const [requestError, setRequestError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [authType, setAuthType] = useState<AuthType>("none");
  const [authValue, setAuthValue] = useState("");
  const [authKeyName, setAuthKeyName] = useState("X-API-Key");
  const [authSource, setAuthSource] = useState<AuthSource>("env");
  const [showSpecLoader, setShowSpecLoader] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const specPromptDismissedRef = useRef<Set<string>>(new Set());
  const prevWorkspaceIdRef = useRef("");
  const [isEnvPanelOpen, setIsEnvPanelOpen] = useState(false);
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [workbenchHeader, setWorkbenchHeader] = useState<WorkbenchHeaderConfig | null>(null);
  const showTryOut = !isEmbedSurface();
  const allowImportSpec = canImportSpec();
  const embedConfig = getSpecoraEmbedConfig();
  const sdkDownloadUrls = embedConfig?.specUrl
    ? { json: embedConfig.downloadJsonUrl, yaml: embedConfig.downloadYamlUrl }
    : undefined;

  useEffect(() => {
    const specUrl = embedConfig?.specUrl;
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
        setSpecVersionLabel(result.version.label);
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
    allowImportSpec && Boolean(activeWorkspace) && !activeWorkspace?.spec;

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
    if (!allowImportSpec || !workspacesHydrated || !activeWorkspace) {
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
    if (!workspacesHydrated) {
      return;
    }

    if (workspaces.length === 0) {
      createWorkspace("Default Workspace", "Primary workspace");
      return;
    }

    if (!activeWorkspaceId || !activeWorkspace) {
      switchWorkspace(workspaces[0].id);
    }
  }, [
    workspacesHydrated,
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    createWorkspace,
    switchWorkspace,
  ]);

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
      const versionResult = parseSpecText(
        activeWorkspace.specSource?.type === "text"
          ? activeWorkspace.specSource.value
          : JSON.stringify(activeWorkspace.spec)
      );
      if (versionResult.ok) {
        setSpecVersionLabel(versionResult.version.label);
      }
    } else if (workspaceChanged) {
      setSpec(null);
      setSpecVersionLabel("");
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
    if (isEmbedSurface() && !embedConfig?.includeAll) {
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

  const tagGroups = useMemo(
    () => groupOperationsByTags(filteredOperations, searchTerm),
    [filteredOperations, searchTerm]
  );

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
    if (authSource !== "env") return;
    const authFields = authFieldsForUi({ authSource: "env" }, activeEnv);
    setAuthType(authFields.authType);
    setAuthValue(authFields.authValue);
    setAuthKeyName(authFields.authKeyName);
  // Only re-run when the active env ID changes, not on every field edit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEnvId]);

  useEffect(() => {
    if (authSource !== "env" || !activeEnv) return;
    const authFields = authFieldsForUi({ authSource: "env" }, activeEnv);
    setAuthType(authFields.authType);
    setAuthValue(authFields.authValue);
    setAuthKeyName(authFields.authKeyName);
  }, [activeEnv?.auth, authSource, activeEnv]);

  // When the selected operation changes, auto-scaffold params from the spec definition.
  // We key on the stable string ID so typing in the search box doesn't reset manual edits.
  const selectedOpKey = selectedOperation ? operationKey(selectedOperation) : "";
  useEffect(() => {
    if (!selectedOperation) return;
    const { pathParams, queryParams, headers } = scaffoldFromOperation(selectedOperation);
    const fmtParams = (obj: Record<string, string>) => serializeParamRecord(obj);
    const fmtQueryParams = (obj: Record<string, string>) =>
      serializeParamRecord(obj, { defaultEnabled: false });
    const fmt = (obj: Record<string, string>) =>
      Object.keys(obj).length > 0 ? JSON.stringify(obj, null, 2) : "{}";
    setPathParamsInput(fmtParams(pathParams));
    setQueryParamsInput(fmtQueryParams(queryParams));
    setHeadersInput(fmt(headers));
    setAuthSource("env");
    const authFields = authFieldsForUi({ authSource: "env" }, activeEnv);
    setAuthType(authFields.authType);
    setAuthValue(authFields.authValue);
    setAuthKeyName(authFields.authKeyName);
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
      setSpecVersionLabel(result.version.label);
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
    setSpecVersionLabel(result.version.label);
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
    setSpecVersionLabel(result.version.label);
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

    const scaffold = scaffoldFromOperation(selectedOperation);
    const pathParams = parseParamRowsToRecord(pathParamsInput, scaffold.pathParams, {
      respectEnabled: false
    });
    const queryParams = parseParamRowsToRecord(queryParamsInput, scaffold.queryParams);

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

    const targetUrl = resolveRequestUrl({
      serverUrl: applyVariables(serverUrl, vars),
      endpointPath: selectedOperation.path,
      pathParams: applyVars(pathParams),
      queryParams: applyVars(queryParams)
    });

    const method = selectedOperation.method;
    const canSendBody = !["GET", "HEAD"].includes(method);
    const body = canSendBody && requestBody.trim() ? applyVariables(requestBody, vars) : undefined;
    const authCfg =
      authSource === "custom"
        ? { type: authType, value: authValue, keyName: authKeyName }
        : authFromEnvironment(activeEnv);
    const mergedHeaders = applyVars({ ...parsedHeaders.data, ...buildAuthHeaders(authCfg) });
    const start = performance.now();

    try {
      if (useProxy) {
        const payload = await fetchViaTryoutProxy(proxyUrl, {
          url: targetUrl,
          method,
          headers: mergedHeaders,
          body: body ?? null
        });

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

  const useApiClient = Boolean(spec && showTryOut && isFullAppSurface());

  const openSpecLoader = useCallback(() => {
    setShowSpecLoader(true);
    setLoadMode("url");
    setTimeout(() => urlInputRef.current?.focus(), 50);
  }, []);

  return (
    <div className="app-shell app-shell-with-header">
      <AppHeader
        apiTitle={apiTitle}
        apiVersion={apiVersion}
        specVersionLabel={specVersionLabel || undefined}
        hasSpec={Boolean(spec)}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onSwitchWorkspace={switchWorkspace}
        onCreateWorkspace={(name, description) => createWorkspace(name, description)}
        onRenameWorkspace={renameWorkspace}
        onDeleteWorkspace={deleteWorkspace}
        activeEnvName={activeEnv?.name}
        onOpenEnvironment={() => setIsEnvPanelOpen(true)}
        onImportSpec={allowImportSpec ? openSpecLoader : undefined}
        onOpenSettings={() => setShowSettings(true)}
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
        showImportSpec={allowImportSpec}
        sdkDownloadUrls={sdkDownloadUrls}
        workbench={useApiClient ? workbenchHeader : null}
        showExportPostman={!isSdkEmbeddedContext()}
      />

      <div className="app-body">
        <main className={`main-panel ${useApiClient ? "main-panel-client" : ""}`}>
          {useApiClient && activeWorkspaceId ? (
            <ApiClientWorkbench
              workspaceId={activeWorkspaceId}
              spec={spec!}
              operations={operations}
              onWorkbenchHeaderChange={setWorkbenchHeader}
              serverUrl={serverUrl}
              onServerUrlChange={setServerUrl}
              useProxy={useProxy}
              onUseProxyChange={setUseProxy}
              proxyUrl={proxyUrl}
              onProxyUrlChange={setProxyUrl}
              activeEnv={activeEnv}
            />
          ) : (
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
              onAuthTypeChange={(value) => {
                setAuthSource("custom");
                setAuthType(value);
              }}
              authValue={authValue}
              onAuthValueChange={(value) => {
                setAuthSource("custom");
                setAuthValue(value);
              }}
              authKeyName={authKeyName}
              onAuthKeyNameChange={(value) => {
                setAuthSource("custom");
                setAuthKeyName(value);
              }}
              authSource={authSource}
              onUseEnvAuth={() => {
                setAuthSource("env");
                const fields = authFieldsForUi({ authSource: "env" }, activeEnv);
                setAuthType(fields.authType);
                setAuthValue(fields.authValue);
                setAuthKeyName(fields.authKeyName);
              }}
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
          )}
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
