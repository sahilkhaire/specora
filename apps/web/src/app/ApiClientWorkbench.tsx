import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import { exportPostmanCollectionV21 } from "@specora/import-postman/export";
import {
  findOperationByKey,
  getUsedSchemaDetailsForOperation,
  type OperationItem
} from "@/features/spec/spec-utils";
import { OperationInsightPanel } from "@/features/schemas/OperationInsightPanel";
import {
  getOperationPayloads,
  getPrimaryRequestBodySchema
} from "@/features/schemas/operation-payloads";
import { sampleToJson } from "@/features/schemas/schema-samples";
import { TryOutPanel } from "@/features/tryout/TryOutPanel";
import { VariableHighlightInput } from "@/features/tryout/VariableHighlight";
import { scaffoldFromOperation, parseRecordJson, methodBadgeClass, prettyResponseBody, applyVariables, resolveRequestUrl, resolveDisplayRequestUrl, stripUrlQuery, pathFromColonParams } from "@/features/tryout/tryout-utils";
import {
  mergeParamRowsInput,
  parseParamRowsToRecord,
  serializeParamRecord,
  serializeParamRows
} from "@/features/tryout/param-rows";
import type { AuthType } from "@/features/tryout/tryout-utils";
import type { Environment } from "@/features/environments/env-types";
import { AppShell } from "./AppShell";
import { CollectionSidebar } from "@/features/collections/CollectionSidebar";
import { PostmanImportDialog } from "@/features/collections/PostmanImportDialog";
import { SaveExchangeDialog } from "@/features/collections/SaveExchangeDialog";
import { RequestHistoryPanel } from "@/features/collections/RequestHistoryPanel";
import { useCollections } from "@/features/collections/use-collections";
import { createCustomRequest } from "@/features/collections/collection-bootstrap";
import type { RequestHistoryEntry, SavedExchange, SavedRequest } from "@/features/collections/collection-types";
import {
  readHistoryPanelOpen,
  readSchemaPanelOpen,
  writeHistoryPanelOpen,
  writeSchemaPanelOpen
} from "@/features/collections/panel-prefs";
import type { WorkbenchHeaderConfig } from "@/app/header-types";
import { executeRequest } from "@/features/http/execute-request";
import { useDataContext } from "@/data/DataProvider";

interface ApiClientWorkbenchProps {
  workspaceId: string;
  spec: Record<string, unknown>;
  operations: OperationItem[];
  onWorkbenchHeaderChange?: (config: WorkbenchHeaderConfig | null) => void;
  serverUrl: string;
  onServerUrlChange: (value: string) => void;
  useProxy: boolean;
  onUseProxyChange: (value: boolean) => void;
  proxyUrl: string;
  onProxyUrlChange: (value: string) => void;
  activeEnv: Environment | null;
}

export function ApiClientWorkbench({
  workspaceId,
  spec,
  operations,
  onWorkbenchHeaderChange,
  serverUrl,
  onServerUrlChange,
  useProxy,
  onUseProxyChange,
  proxyUrl,
  onProxyUrlChange,
  activeEnv
}: ApiClientWorkbenchProps) {
  const { stores } = useDataContext();
  const {
    state: collectionState,
    selectedRequestId,
    setSelectedRequestId,
    selectedRequest,
    updateRequest,
    addCustomRequest,
    importFromPostman,
    addExchange,
    removeExchange,
    exchangesForSelected
  } = useCollections(workspaceId, spec);

  const [pathParamsInput, setPathParamsInput] = useState("{}");
  const [queryParamsInput, setQueryParamsInput] = useState("{}");
  const [headersInput, setHeadersInput] = useState("{}");
  const [requestBody, setRequestBody] = useState("");
  const [authType, setAuthType] = useState<AuthType>("none");
  const [authValue, setAuthValue] = useState("");
  const [authKeyName, setAuthKeyName] = useState("X-API-Key");
  const [requestStatus, setRequestStatus] = useState("");
  const [requestResponse, setRequestResponse] = useState("");
  const [requestHeaders, setRequestHeaders] = useState<Record<string, string>>({});
  const [requestTiming, setRequestTiming] = useState<number | null>(null);
  const [requestError, setRequestError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [postmanOpen, setPostmanOpen] = useState(false);
  const [saveExchangeOpen, setSaveExchangeOpen] = useState(false);
  const [saveExchangeDefaultName, setSaveExchangeDefaultName] = useState("");
  const [historyOpen, setHistoryOpen] = useState(readHistoryPanelOpen);
  const [schemaPanelOpen, setSchemaPanelOpen] = useState(readSchemaPanelOpen);
  const [history, setHistory] = useState<RequestHistoryEntry[]>([]);

  useEffect(() => {
    if (!workspaceId) return;
    void stores.history.list(workspaceId).then(setHistory);
  }, [workspaceId, stores.history]);

  const linkedOperation = useMemo(() => {
    if (!selectedRequest?.operationKey) return null;
    return findOperationByKey(operations, selectedRequest.operationKey) ?? null;
  }, [operations, selectedRequest?.operationKey]);

  const paramScaffold = useMemo(() => {
    if (!linkedOperation) return null;
    return scaffoldFromOperation(linkedOperation);
  }, [linkedOperation]);

  const displayUrl = useMemo(() => {
    if (!selectedRequest) return "";
    const pathTemplate = linkedOperation?.path ?? selectedRequest.url;

    return resolveDisplayRequestUrl({
      serverUrl,
      endpointPath: pathTemplate,
      queryParams: parseParamRowsToRecord(queryParamsInput, paramScaffold?.queryParams)
    });
  }, [linkedOperation?.path, paramScaffold, queryParamsInput, selectedRequest, serverUrl]);

  const resolvedUrl = useMemo(() => {
    if (!selectedRequest) return "";
    const vars = activeEnv?.variables ?? {};
    const applyVars = (obj: Record<string, string>) =>
      Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, applyVariables(v, vars)]));

    return resolveRequestUrl({
      serverUrl: applyVariables(serverUrl, vars),
      endpointPath: applyVariables(selectedRequest.url, vars),
      pathParams: applyVars(
        parseParamRowsToRecord(pathParamsInput, paramScaffold?.pathParams, { respectEnabled: false })
      ),
      queryParams: applyVars(parseParamRowsToRecord(queryParamsInput, paramScaffold?.queryParams))
    });
  }, [
    activeEnv,
    paramScaffold,
    pathParamsInput,
    queryParamsInput,
    selectedRequest,
    serverUrl
  ]);

  useEffect(() => {
    if (!selectedRequest) return;

    if (linkedOperation) {
      const scaffold = scaffoldFromOperation(linkedOperation);
      setPathParamsInput(
        serializeParamRows(
          mergeParamRowsInput(serializeParamRecord(selectedRequest.pathParams), scaffold.pathParams)
        )
      );
      setQueryParamsInput(
        serializeParamRows(
          mergeParamRowsInput(serializeParamRecord(selectedRequest.queryParams), scaffold.queryParams)
        )
      );
      setHeadersInput(JSON.stringify(
        Object.keys(scaffold.headers).length > 0
          ? { ...scaffold.headers, ...selectedRequest.headers }
          : selectedRequest.headers,
        null,
        2
      ));
    } else {
      setPathParamsInput(serializeParamRecord(selectedRequest.pathParams));
      setQueryParamsInput(serializeParamRecord(selectedRequest.queryParams));
      setHeadersInput(JSON.stringify(selectedRequest.headers, null, 2));
    }
    setRequestBody(selectedRequest.body.content);
    setAuthType(selectedRequest.authType ?? "none");
    setAuthValue(selectedRequest.authValue ?? "");
    setAuthKeyName(selectedRequest.authKeyName ?? "X-API-Key");
    setRequestStatus("");
    setRequestResponse("");
    setRequestHeaders({});
    setRequestTiming(null);
    setRequestError("");

  }, [selectedRequest?.id, linkedOperation?.key]);

  const persistDraft = useCallback(() => {
    if (!selectedRequest) return;
    updateRequest(selectedRequest.id, {
      pathParams: parseParamRowsToRecord(pathParamsInput, paramScaffold?.pathParams, {
        respectEnabled: false
      }),
      queryParams: parseParamRowsToRecord(queryParamsInput, paramScaffold?.queryParams),
      headers: parseRecordJson(headersInput),
      body: requestBody ? { mode: "json", content: requestBody } : { mode: "none", content: "" },
      authType,
      authValue,
      authKeyName,
      method: selectedRequest.method,
      url: selectedRequest.url
    });
  }, [
    authKeyName,
    authType,
    authValue,
    headersInput,
    pathParamsInput,
    queryParamsInput,
    requestBody,
    selectedRequest,
    paramScaffold,
    updateRequest
  ]);

  const sendRequest = useCallback(async () => {
    if (!selectedRequest) return;
    persistDraft();

    const draft: SavedRequest = {
      ...selectedRequest,
      pathParams: parseParamRowsToRecord(pathParamsInput, paramScaffold?.pathParams, {
        respectEnabled: false
      }),
      queryParams: parseParamRowsToRecord(queryParamsInput, paramScaffold?.queryParams),
      headers: parseRecordJson(headersInput),
      body: requestBody.trim()
        ? { mode: "json", content: requestBody }
        : { mode: "none", content: "" },
      authType,
      authValue,
      authKeyName
    };

    setIsSending(true);
    setRequestError("");
    setRequestStatus("");
    setRequestResponse("");
    const result = await executeRequest({
      request: draft,
      serverUrl,
      environment: activeEnv,
      useProxy,
      proxyUrl
    });
    setIsSending(false);

    if (result.error) {
      setRequestError(result.error);
      setRequestStatus("");
      toast.error(result.error);
      return;
    }

    setRequestStatus(String(result.status ?? ""));
    setRequestTiming(result.durationMs);
    setRequestHeaders(result.responseHeaders);
    setRequestResponse(prettyResponseBody(result.responseBody));
    toast.success(`Response ${result.status} in ${result.durationMs}ms`);

    const entry: RequestHistoryEntry = {
      id: `hist_${crypto.randomUUID().slice(0, 8)}`,
      savedRequestId: selectedRequest.id,
      operationKey: selectedRequest.operationKey,
      method: selectedRequest.method,
      url: draft.url,
      status: result.status,
      durationMs: result.durationMs,
      responsePreview: result.responseBody.slice(0, 500),
      createdAt: new Date().toISOString()
    };
    const nextHistory = [entry, ...history].slice(0, 100);
    setHistory(nextHistory);
    void stores.history.save(workspaceId, nextHistory);
  }, [
    activeEnv,
    authKeyName,
    authType,
    authValue,
    history,
    pathParamsInput,
    paramScaffold,
    persistDraft,
    proxyUrl,
    queryParamsInput,
    headersInput,
    requestBody,
    selectedRequest,
    serverUrl,
    stores.history,
    useProxy,
    workspaceId
  ]);

  const handleSaveExchangeClick = useCallback(() => {
    if (!selectedRequest || !requestResponse.trim()) return;

    const defaultName = `${requestStatus || "Response"} · ${new Date().toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    })}`;
    setSaveExchangeDefaultName(defaultName);
    setSaveExchangeOpen(true);
  }, [requestResponse, requestStatus, selectedRequest]);

  const handleSaveExchangeConfirm = useCallback(
    (label: string) => {
      if (!selectedRequest || !requestResponse.trim()) return;

      const defaultName = saveExchangeDefaultName;
      const exchange: SavedExchange = {
        id: `ex_${crypto.randomUUID().slice(0, 8)}`,
        savedRequestId: selectedRequest.id,
        name: label.trim() || defaultName,
        requestSnapshot: {
          method: selectedRequest.method,
          url: selectedRequest.url,
          pathParams: parseParamRowsToRecord(pathParamsInput, paramScaffold?.pathParams, {
        respectEnabled: false
      }),
          queryParams: parseParamRowsToRecord(queryParamsInput, paramScaffold?.queryParams),
          headers: parseRecordJson(headersInput),
          body: requestBody
            ? { mode: "json", content: requestBody }
            : { mode: "none", content: "" },
          authType,
          authValue,
          authKeyName
        },
        response: {
          status: requestStatus ? Number(requestStatus) : undefined,
          durationMs: requestTiming ?? 0,
          headers: requestHeaders,
          body: requestResponse
        },
        createdAt: new Date().toISOString()
      };

      addExchange(exchange);
      toast.success("Saved request and response");
    },
    [
      addExchange,
      authKeyName,
      authType,
      authValue,
      headersInput,
      pathParamsInput,
      queryParamsInput,
      paramScaffold,
      requestBody,
      requestHeaders,
      requestResponse,
      requestStatus,
      requestTiming,
      saveExchangeDefaultName,
      selectedRequest
    ]
  );

  const handleLoadExchange = useCallback(
    (exchange: SavedExchange) => {
      const snap = exchange.requestSnapshot;
      if (linkedOperation) {
        const scaffold = scaffoldFromOperation(linkedOperation);
        setPathParamsInput(
          serializeParamRows(mergeParamRowsInput(serializeParamRecord(snap.pathParams), scaffold.pathParams))
        );
        setQueryParamsInput(
          serializeParamRows(mergeParamRowsInput(serializeParamRecord(snap.queryParams), scaffold.queryParams))
        );
      } else {
        setPathParamsInput(serializeParamRecord(snap.pathParams));
        setQueryParamsInput(serializeParamRecord(snap.queryParams));
      }
      setHeadersInput(JSON.stringify(snap.headers, null, 2));
      setRequestBody(snap.body.content);
      setAuthType(snap.authType ?? "none");
      setAuthValue(snap.authValue ?? "");
      setAuthKeyName(snap.authKeyName ?? "X-API-Key");
      setRequestStatus(String(exchange.response.status ?? ""));
      setRequestTiming(exchange.response.durationMs);
      setRequestHeaders(exchange.response.headers);
      setRequestResponse(exchange.response.body);
      setRequestError("");

      if (selectedRequest) {
        updateRequest(selectedRequest.id, {
          method: snap.method,
          url: snap.url,
          pathParams: snap.pathParams,
          queryParams: snap.queryParams,
          headers: snap.headers,
          body: snap.body,
          authType: snap.authType,
          authValue: snap.authValue,
          authKeyName: snap.authKeyName
        });
      }

      toast.success("Loaded saved request and response");
    },
    [linkedOperation, selectedRequest, updateRequest]
  );

  const handleDeleteExchange = useCallback(
    (id: string) => {
      removeExchange(id);
      toast.success("Deleted saved exchange");
    },
    [removeExchange]
  );

  const toggleHistoryPanel = useCallback(() => {
    setHistoryOpen((open) => {
      const next = !open;
      writeHistoryPanelOpen(next);
      return next;
    });
  }, []);

  const toggleSchemaPanel = useCallback(() => {
    setSchemaPanelOpen((open) => {
      const next = !open;
      writeSchemaPanelOpen(next);
      return next;
    });
  }, []);

  const insightOperation: OperationItem | null = useMemo(() => {
    if (linkedOperation) return linkedOperation;
    if (!selectedRequest) return null;
    return {
      key: selectedRequest.operationKey ?? selectedRequest.id,
      method: selectedRequest.method,
      path: selectedRequest.url.startsWith("/") ? selectedRequest.url : "/",
      summary: selectedRequest.name,
      operationId: "",
      tags: [],
      description: selectedRequest.description ?? "",
      parameters: [],
      requestBody: null,
      searchTextLower: ""
    };
  }, [linkedOperation, selectedRequest]);

  const usedSchemaDetails = insightOperation
    ? getUsedSchemaDetailsForOperation(spec, insightOperation)
    : [];

  const lastAutoBodyRequestId = useRef("");

  useEffect(() => {
    if (!linkedOperation || !selectedRequest) return;
    if (lastAutoBodyRequestId.current === selectedRequest.id) return;
    lastAutoBodyRequestId.current = selectedRequest.id;

    const payloads = getOperationPayloads(spec, linkedOperation);
    const schema = getPrimaryRequestBodySchema(payloads);
    if (!schema) return;

    const hasBody =
      selectedRequest.body.mode !== "none" && selectedRequest.body.content.trim().length > 0;
    if (hasBody) {
      return;
    }

    const json = sampleToJson(spec, schema, "empty");
    if (json && json !== "{}") {
      setRequestBody(json);
      updateRequest(selectedRequest.id, { body: { mode: "json", content: json } });
    }
  }, [linkedOperation, selectedRequest, spec, updateRequest]);

  const handleExportPostman = useCallback(() => {
    const exported = exportPostmanCollectionV21({
      format: "v2.1",
      name: String((spec.info as { title?: string })?.title ?? "Specora Export"),
      folders: collectionState.nodes
        .filter((n) => n.kind === "folder")
        .map((n) => ({
          id: n.id,
          name: n.name,
          parentId: n.parentId,
          sortOrder: n.sortOrder
        })),
      requests: collectionState.requests.map((r, i) => ({
        ...r,
        pathParams: r.pathParams,
        queryParams: r.queryParams,
        headers: r.headers,
        body: r.body,
        folderId:
          collectionState.nodes.find((n) => n.kind === "request" && n.requestId === r.id)?.parentId ??
          null,
        sortOrder: i
      })),
      warnings: []
    });
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "specora-collection.postman_collection.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported Postman Collection v2.1");
  }, [collectionState.nodes, collectionState.requests, spec]);

  useEffect(() => {
    if (!onWorkbenchHeaderChange) return;
    onWorkbenchHeaderChange({
      historyOpen,
      onToggleHistory: toggleHistoryPanel,
      onExportPostman: handleExportPostman
    });
    return () => onWorkbenchHeaderChange(null);
  }, [handleExportPostman, historyOpen, onWorkbenchHeaderChange, toggleHistoryPanel]);

  return (
    <>
      <Toaster richColors position="top-right" theme="system" />
      <AppShell
        sidebar={
          <CollectionSidebar
            nodes={collectionState.nodes}
            requests={collectionState.requests}
            selectedRequestId={selectedRequestId}
            onSelectRequest={setSelectedRequestId}
            onNewRequest={() => {
              const { node, request } = createCustomRequest();
              addCustomRequest(node, request);
              toast.success("Created custom request");
            }}
            onImportPostman={() => setPostmanOpen(true)}
            schemaPanelOpen={schemaPanelOpen}
            onToggleSchemaPanel={toggleSchemaPanel}
          />
        }
        main={
          <div className="client-main-stack">
            {selectedRequest ? (
              <>
                <div className="request-url-stack">
                  <div className="request-command-bar">
                    <select
                      className={`request-method-select ${methodBadgeClass(selectedRequest.method)}`}
                      value={selectedRequest.method}
                      onChange={(e) =>
                        updateRequest(selectedRequest.id, { method: e.target.value })
                      }
                      aria-label="HTTP method"
                    >
                      {["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <VariableHighlightInput
                      className="request-url-input"
                      value={displayUrl || selectedRequest.url}
                      variables={activeEnv?.variables ?? {}}
                      onChange={(next) => {
                        const withoutQuery = stripUrlQuery(next);
                        let pathTemplate = withoutQuery;
                        if (withoutQuery.startsWith("http")) {
                          try {
                            pathTemplate = new URL(withoutQuery).pathname;
                          } catch {
                            pathTemplate =
                              withoutQuery.replace(/^https?:\/\/[^/]+/i, "") || "/";
                          }
                        }
                        updateRequest(selectedRequest.id, {
                          url: pathFromColonParams(
                            pathTemplate.startsWith("/") ? pathTemplate : `/${pathTemplate}`
                          )
                        });
                      }}
                      placeholder="https://api.example.com/path/:id"
                      aria-label="Request URL"
                    />
                    <button
                      type="button"
                      className={`request-send-btn request-send-btn--${selectedRequest.method.toLowerCase()}`}
                      onClick={() => void sendRequest()}
                      disabled={isSending}
                    >
                      {isSending ? "Sending…" : "Send"}
                    </button>
                  </div>
                  {resolvedUrl && resolvedUrl !== displayUrl ? (
                    <div className="request-url-resolved-hint" title={resolvedUrl}>
                      <span className="request-url-resolved-hint-label">Sends as</span>
                      <code>{resolvedUrl}</code>
                    </div>
                  ) : null}
                </div>
                <TryOutPanel
                  variant="embedded"
                  requestMethod={selectedRequest.method}
                  requestPath={selectedRequest.url}
                  selectedOperation={linkedOperation}
                  serverUrl={serverUrl}
                  onServerUrlChange={onServerUrlChange}
                  useProxy={useProxy}
                  onUseProxyChange={onUseProxyChange}
                  proxyUrl={proxyUrl}
                  onProxyUrlChange={onProxyUrlChange}
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
                  hasBodySchema={Boolean(
                    linkedOperation && getPrimaryRequestBodySchema(getOperationPayloads(spec, linkedOperation))
                  )}
                  onFillEmptyBody={
                    linkedOperation
                      ? () => {
                          const schema = getPrimaryRequestBodySchema(
                            getOperationPayloads(spec, linkedOperation)
                          );
                          if (!schema || !selectedRequest) return;
                          const json = sampleToJson(spec, schema, "empty");
                          setRequestBody(json);
                          updateRequest(selectedRequest.id, { body: { mode: "json", content: json } });
                        }
                      : undefined
                  }
                  onFillExampleBody={
                    linkedOperation
                      ? () => {
                          const schema = getPrimaryRequestBodySchema(
                            getOperationPayloads(spec, linkedOperation)
                          );
                          if (!schema || !selectedRequest) return;
                          const json = sampleToJson(spec, schema, "example");
                          setRequestBody(json);
                          updateRequest(selectedRequest.id, { body: { mode: "json", content: json } });
                        }
                      : undefined
                  }
                  savedExchanges={exchangesForSelected}
                  onSaveExchange={handleSaveExchangeClick}
                  onLoadExchange={handleLoadExchange}
                  onDeleteExchange={handleDeleteExchange}
                />
              </>
            ) : (
              <p className="empty-message">Select a request from the collection.</p>
            )}
          </div>
        }
        docs={
          schemaPanelOpen
            ? insightOperation
              ? (
                  <OperationInsightPanel
                    spec={spec}
                    operation={insightOperation}
                    usedSchemas={usedSchemaDetails}
                    onApplyRequestBody={(json) => {
                      setRequestBody(json);
                      if (selectedRequest) {
                        updateRequest(selectedRequest.id, { body: { mode: "json", content: json } });
                        toast.success("Request body updated from schema");
                      }
                    }}
                  />
                )
              : (
                  <div className="operation-insight-panel operation-insight-panel--empty">
                    <p className="empty-message">
                      Select a request to view schema reference and payload templates.
                    </p>
                  </div>
                )
            : undefined
        }
        history={
          historyOpen ? (
            <RequestHistoryPanel
              entries={history}
              onClose={() => {
                setHistoryOpen(false);
                writeHistoryPanelOpen(false);
              }}
              onReplay={(entry) => {
                if (entry.savedRequestId) {
                  setSelectedRequestId(entry.savedRequestId);
                  toast.message("Replay loaded request");
                }
              }}
            />
          ) : null
        }
      />
      <PostmanImportDialog
        open={postmanOpen}
        onOpenChange={setPostmanOpen}
        onImportCollection={(nodes, requests) => {
          importFromPostman(nodes, requests);
          toast.success(`Imported ${requests.length} requests`);
        }}
        onImportEnvironment={(name, variables) => {
          toast.success(`Environment "${name}" ready — open Environment panel to apply`);
          void variables;
        }}
      />
      <SaveExchangeDialog
        open={saveExchangeOpen}
        defaultName={saveExchangeDefaultName}
        onOpenChange={setSaveExchangeOpen}
        onSave={handleSaveExchangeConfirm}
      />
    </>
  );
}
