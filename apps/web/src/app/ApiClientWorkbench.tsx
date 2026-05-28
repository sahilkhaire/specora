import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import { exportPostmanCollectionV21 } from "@specora/import-postman";
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
import { scaffoldFromParameters, parseRecordJson } from "@/features/tryout/tryout-utils";
import type { AuthType } from "@/features/tryout/tryout-utils";
import type { Environment } from "@/features/environments/env-types";
import { AppShell } from "./AppShell";
import { CollectionSidebar } from "@/features/collections/CollectionSidebar";
import { PostmanImportDialog } from "@/features/collections/PostmanImportDialog";
import { RequestHistoryPanel } from "@/features/collections/RequestHistoryPanel";
import { useCollections } from "@/features/collections/use-collections";
import { createCustomRequest } from "@/features/collections/collection-bootstrap";
import { parseCurlToRequest } from "@/features/collections/parse-curl";
import type { RequestHistoryEntry, SavedRequest } from "@/features/collections/collection-types";
import { executeRequest } from "@/features/http/execute-request";
import { Button } from "@/shared/ui/Button";
import { useDataContext } from "@/data/DataProvider";

interface ApiClientWorkbenchProps {
  workspaceId: string;
  spec: Record<string, unknown>;
  operations: OperationItem[];
  onHeaderActionsChange?: (actions: React.ReactNode) => void;
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
  onHeaderActionsChange,
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
    importFromPostman
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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<RequestHistoryEntry[]>([]);
  const [curlInput, setCurlInput] = useState("");

  useEffect(() => {
    if (!workspaceId) return;
    void stores.history.list(workspaceId).then(setHistory);
  }, [workspaceId, stores.history]);

  const linkedOperation = useMemo(() => {
    if (!selectedRequest?.operationKey) return null;
    return findOperationByKey(operations, selectedRequest.operationKey) ?? null;
  }, [operations, selectedRequest?.operationKey]);

  useEffect(() => {
    if (!selectedRequest) return;

    setPathParamsInput(JSON.stringify(selectedRequest.pathParams, null, 2));
    setQueryParamsInput(JSON.stringify(selectedRequest.queryParams, null, 2));
    setHeadersInput(JSON.stringify(selectedRequest.headers, null, 2));
    setRequestBody(selectedRequest.body.content);
    setAuthType(selectedRequest.authType ?? "none");
    setAuthValue(selectedRequest.authValue ?? "");
    setAuthKeyName(selectedRequest.authKeyName ?? "X-API-Key");

    if (linkedOperation && Object.keys(selectedRequest.pathParams).length === 0) {
      const scaffold = scaffoldFromParameters(linkedOperation.parameters);
      setPathParamsInput(JSON.stringify(scaffold.pathParams, null, 2));
      setQueryParamsInput(JSON.stringify(scaffold.queryParams, null, 2));
      setHeadersInput(JSON.stringify(scaffold.headers, null, 2));
    }
  }, [selectedRequest?.id, linkedOperation, selectedRequest]);

  const persistDraft = useCallback(() => {
    if (!selectedRequest) return;
    updateRequest(selectedRequest.id, {
      pathParams: parseRecordJson(pathParamsInput),
      queryParams: parseRecordJson(queryParamsInput),
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
    updateRequest
  ]);

  const sendRequest = useCallback(async () => {
    if (!selectedRequest) return;
    persistDraft();

    const draft: SavedRequest = {
      ...selectedRequest,
      pathParams: parseRecordJson(pathParamsInput),
      queryParams: parseRecordJson(queryParamsInput),
      headers: parseRecordJson(headersInput),
      body: requestBody ? { mode: "json", content: requestBody } : { mode: "none", content: "" }
    };

    setIsSending(true);
    setRequestError("");
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
    setRequestResponse(result.responseBody);
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
    history,
    pathParamsInput,
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
    if (!onHeaderActionsChange) return;
    onHeaderActionsChange(
      <>
        <Button variant="ghost" onClick={() => setHistoryOpen((v) => !v)}>
          History
        </Button>
        <Button variant="ghost" onClick={handleExportPostman}>
          Export Postman
        </Button>
      </>
    );
    return () => onHeaderActionsChange(null);
  }, [handleExportPostman, historyOpen, onHeaderActionsChange]);

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
          />
        }
        main={
          <div className="client-main-stack">
            {selectedRequest ? (
              <>
                <div className="request-command-bar">
                  <select
                    className="request-method-select"
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
                  <input
                    className="request-url-input"
                    value={selectedRequest.url}
                    onChange={(e) => updateRequest(selectedRequest.id, { url: e.target.value })}
                    placeholder="https://api.example.com/path"
                  />
                  <Button onClick={() => void sendRequest()} disabled={isSending}>
                    {isSending ? "Sending…" : "Send"}
                  </Button>
                </div>
                <TryOutPanel
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
                />
                <details className="curl-import-details">
                  <summary>Import from cURL</summary>
                  <textarea
                    value={curlInput}
                    onChange={(e) => setCurlInput(e.target.value)}
                    placeholder="curl -X GET https://api.example.com/..."
                    rows={3}
                  />
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const parsed = parseCurlToRequest(curlInput);
                      if (!parsed || !selectedRequest) {
                        toast.error("Could not parse cURL command");
                        return;
                      }
                      updateRequest(selectedRequest.id, {
                        method: parsed.method,
                        url: parsed.url,
                        headers: parsed.headers,
                        body: parsed.body
                      });
                      toast.success("Applied cURL to request");
                    }}
                  >
                    Apply cURL
                  </Button>
                </details>
              </>
            ) : (
              <p className="empty-message">Select a request from the collection.</p>
            )}
          </div>
        }
        docs={
          insightOperation ? (
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
          ) : (
            <div className="operation-insight-panel operation-insight-panel--empty">
              <p className="empty-message">Select a request to view schema reference and payload templates.</p>
            </div>
          )
        }
        history={
          historyOpen ? (
            <RequestHistoryPanel
              entries={history}
              onClose={() => setHistoryOpen(false)}
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
    </>
  );
}
