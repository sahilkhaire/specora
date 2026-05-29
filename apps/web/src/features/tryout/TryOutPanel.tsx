import { useMemo, useState } from "react";
import type { OperationItem } from "@/features/spec/spec-utils";
import type { Environment } from "@/features/environments/env-types";
import type { SavedExchange } from "@/features/collections/collection-types";
import { SavedExchangesPanel } from "@/features/collections/SavedExchangesPanel";
import {
  applyVariables,
  buildAuthHeaders,
  buildCurlCommand,
  buildRequestUrl,
  methodBadgeClass,
  safeParseRecord,
  statusBadgeClass,
  type AuthConfig,
  type AuthType,
} from "./tryout-utils";

type TryoutTab = "params" | "headers" | "body" | "auth" | "curl" | "saved";

interface TryOutPanelProps {
  variant?: "standalone" | "embedded";
  /** When set (e.g. workbench), overrides operation method for send/display. */
  requestMethod?: string;
  selectedOperation: OperationItem | null;
  serverUrl: string;
  onServerUrlChange: (value: string) => void;
  useProxy: boolean;
  onUseProxyChange: (value: boolean) => void;
  proxyUrl: string;
  onProxyUrlChange: (value: string) => void;
  pathParamsInput: string;
  onPathParamsChange: (value: string) => void;
  queryParamsInput: string;
  onQueryParamsChange: (value: string) => void;
  headersInput: string;
  onHeadersChange: (value: string) => void;
  requestBody: string;
  onRequestBodyChange: (value: string) => void;
  authType: AuthType;
  onAuthTypeChange: (value: AuthType) => void;
  authValue: string;
  onAuthValueChange: (value: string) => void;
  authKeyName: string;
  onAuthKeyNameChange: (value: string) => void;
  activeEnv: Environment | null;
  isSending: boolean;
  onSend: () => void;
  requestError: string;
  requestStatus: string;
  requestTiming: number | null;
  requestHeaders: Record<string, string>;
  requestResponse: string;
  onFillEmptyBody?: () => void;
  onFillExampleBody?: () => void;
  hasBodySchema?: boolean;
  savedExchanges?: SavedExchange[];
  onSaveExchange?: () => void;
  onLoadExchange?: (exchange: SavedExchange) => void;
  onDeleteExchange?: (id: string) => void;
}

export function TryOutPanel({
  variant = "standalone",
  requestMethod,
  selectedOperation,
  serverUrl,
  onServerUrlChange,
  useProxy,
  onUseProxyChange,
  proxyUrl,
  onProxyUrlChange,
  pathParamsInput,
  onPathParamsChange,
  queryParamsInput,
  onQueryParamsChange,
  headersInput,
  onHeadersChange,
  requestBody,
  onRequestBodyChange,
  authType,
  onAuthTypeChange,
  authValue,
  onAuthValueChange,
  authKeyName,
  onAuthKeyNameChange,
  activeEnv,
  isSending,
  onSend,
  requestError,
  requestStatus,
  requestTiming,
  requestHeaders,
  requestResponse,
  onFillEmptyBody,
  onFillExampleBody,
  hasBodySchema = false,
  savedExchanges = [],
  onSaveExchange,
  onLoadExchange,
  onDeleteExchange,
}: TryOutPanelProps) {
  const [tab, setTab] = useState<TryoutTab>("params");
  const [copied, setCopied] = useState<"curl" | "response" | null>(null);

  const vars = activeEnv?.variables ?? {};
  const method = requestMethod ?? selectedOperation?.method ?? "GET";
  const canSendBody = !["GET", "HEAD"].includes(method);

  const previewUrl = useMemo(() => {
    if (!selectedOperation || !serverUrl.trim()) return "";
    const parsedPath = safeParseRecord(pathParamsInput);
    const parsedQuery = safeParseRecord(queryParamsInput);
    if (!parsedPath.ok || !parsedQuery.ok) return "";

    const applyVars = (obj: Record<string, string>) =>
      Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, applyVariables(v, vars)]));

    try {
      return buildRequestUrl({
        baseUrl: applyVariables(serverUrl, vars),
        endpointPath: selectedOperation.path,
        pathParams: applyVars(parsedPath.data),
        queryParams: applyVars(parsedQuery.data),
      });
    } catch {
      return "";
    }
  }, [selectedOperation, serverUrl, pathParamsInput, queryParamsInput, vars]);

  const curlCommand = useMemo(() => {
    if (!previewUrl || !selectedOperation) return "";
    const parsedHeaders = safeParseRecord(headersInput);
    if (!parsedHeaders.ok) return "";

    const applyVars = (obj: Record<string, string>) =>
      Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, applyVariables(v, vars)]));

    const authCfg: AuthConfig = { type: authType, value: authValue, keyName: authKeyName };
    const mergedHeaders = applyVars({ ...parsedHeaders.data, ...buildAuthHeaders(authCfg) });
    const body =
      canSendBody && requestBody.trim() ? applyVariables(requestBody, vars) : undefined;

    return buildCurlCommand({
      method: selectedOperation.method,
      url: previewUrl,
      headers: mergedHeaders,
      body,
    });
  }, [
    previewUrl,
    selectedOperation,
    headersInput,
    authType,
    authValue,
    authKeyName,
    requestBody,
    canSendBody,
    vars,
  ]);

  async function copyText(text: string, kind: "curl" | "response") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }

  const hasResponse = Boolean(requestStatus || requestResponse || requestError);
  const embedded = variant === "embedded";
  const visibleTabs: TryoutTab[] = embedded
    ? ["params", "headers", "body", "auth", ...(savedExchanges.length > 0 ? (["saved"] as TryoutTab[]) : [])]
    : ["params", "headers", "body", "auth", "curl", "saved"];

  function responseBodyContent(): { text: string; placeholder: boolean } {
    if (isSending) {
      return { text: "Waiting for response…", placeholder: true };
    }
    if (requestResponse.trim()) {
      return { text: requestResponse, placeholder: false };
    }
    if (!requestStatus) {
      return { text: "Send a request to see the response here.", placeholder: true };
    }
    if (method.toUpperCase() === "HEAD") {
      return {
        text: "HEAD requests do not include a body. Check response headers above.",
        placeholder: true
      };
    }
    if (Object.keys(requestHeaders).length > 0) {
      return { text: "No response body. Check headers above.", placeholder: true };
    }
    return { text: "Empty response body.", placeholder: true };
  }

  const responseDisplay = responseBodyContent();
  const showHeadersOpen = Boolean(
    requestStatus && !requestResponse.trim() && Object.keys(requestHeaders).length > 0
  );

  return (
    <article className={`detail-card tryout-panel${embedded ? " tryout-panel--embedded" : ""}`}>
      {!embedded ? (
        <>
          <div className="tryout-panel-head">
            <div>
              <h2>Try it out</h2>
              <p className="tryout-panel-sub">Send a live request like Postman or cURL</p>
            </div>
            <label className="tryout-proxy-toggle">
              <input
                type="checkbox"
                checked={useProxy}
                onChange={(event) => onUseProxyChange(event.target.checked)}
              />
              <span>Proxy</span>
            </label>
          </div>

          <div className="tryout-request-bar">
            <span className={methodBadgeClass(method)}>{method}</span>
            <input
              className="tryout-url-input"
              value={serverUrl}
              onChange={(event) => onServerUrlChange(event.target.value)}
              placeholder="https://api.example.com"
              aria-label="Server base URL"
            />
            <button
              type="button"
              className={`tryout-send-btn tryout-send-btn--${method.toLowerCase()}`}
              onClick={onSend}
              disabled={!selectedOperation || isSending}
            >
              {isSending ? "Sending…" : "Send"}
            </button>
          </div>

          {previewUrl ? (
            <div className="tryout-preview-url" title={previewUrl}>
              <span className="tryout-preview-label">Request</span>
              <code>{previewUrl}</code>
            </div>
          ) : null}

          {useProxy ? (
            <div className="tryout-inline-field">
              <label>
                <span>Proxy URL</span>
                <input
                  value={proxyUrl}
                  onChange={(event) => onProxyUrlChange(event.target.value)}
                  placeholder="http://localhost:8787/proxy"
                />
              </label>
              <p className="tryout-env-hint">
                Run <code>npx specora proxy --port 8787</code> locally. Requests stay on your machine.
              </p>
            </div>
          ) : null}
        </>
      ) : null}

      <div className="tryout-tabs-row">
        <div className="tryout-tabs" role="tablist" aria-label="Request parts">
        {visibleTabs.includes("params") ? (
        <button
          type="button"
          role="tab"
          className={tab === "params" ? "active" : ""}
          aria-selected={tab === "params"}
          onClick={() => setTab("params")}
        >
          Params
        </button>
        ) : null}
        {visibleTabs.includes("headers") ? (
        <button
          type="button"
          role="tab"
          className={tab === "headers" ? "active" : ""}
          aria-selected={tab === "headers"}
          onClick={() => setTab("headers")}
        >
          Headers
        </button>
        ) : null}
        {visibleTabs.includes("body") ? (
        <button
          type="button"
          role="tab"
          className={tab === "body" ? "active" : ""}
          aria-selected={tab === "body"}
          disabled={!canSendBody}
          onClick={() => setTab("body")}
        >
          Body
        </button>
        ) : null}
        {visibleTabs.includes("auth") ? (
        <button
          type="button"
          role="tab"
          className={tab === "auth" ? "active" : ""}
          aria-selected={tab === "auth"}
          onClick={() => setTab("auth")}
        >
          Auth
        </button>
        ) : null}
        {visibleTabs.includes("curl") ? (
        <button
          type="button"
          role="tab"
          className={tab === "curl" ? "active" : ""}
          aria-selected={tab === "curl"}
          onClick={() => setTab("curl")}
        >
          cURL
        </button>
        ) : null}
        {visibleTabs.includes("saved") ? (
        <button
          type="button"
          role="tab"
          className={tab === "saved" ? "active" : ""}
          aria-selected={tab === "saved"}
          onClick={() => setTab("saved")}
        >
          Saved{savedExchanges.length > 0 ? ` (${savedExchanges.length})` : ""}
        </button>
        ) : null}
        </div>

        {embedded ? (
          <label className="tryout-proxy-toggle tryout-proxy-toggle--inline">
            <input
              type="checkbox"
              checked={useProxy}
              onChange={(event) => onUseProxyChange(event.target.checked)}
            />
            <span>Proxy</span>
          </label>
        ) : null}
      </div>

      {embedded && useProxy ? (
        <input
          className="tryout-proxy-inline-input"
          value={proxyUrl}
          onChange={(event) => onProxyUrlChange(event.target.value)}
          placeholder="http://localhost:8787/proxy"
          aria-label="Proxy URL"
        />
      ) : null}

      <div className="tryout-tab-panel">
          {tab === "curl" ? (
            <div className="tryout-curl-block">
              <div className="tryout-curl-head">
                <span>cURL command</span>
                <button
                  type="button"
                  className="tryout-ghost-btn"
                  disabled={!curlCommand}
                  onClick={() => void copyText(curlCommand, "curl")}
                >
                  {copied === "curl" ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="tryout-curl-pre">
                {curlCommand || "Complete URL and headers to generate cURL."}
              </pre>
            </div>
          ) : null}

          {tab === "params" ? (
            <div className="tryout-field-grid">
              <label className="tryout-code-field">
                <span>Path params (JSON)</span>
                <textarea
                  value={pathParamsInput}
                  onChange={(event) => onPathParamsChange(event.target.value)}
                  rows={5}
                  spellCheck={false}
                />
              </label>
              <label className="tryout-code-field">
                <span>Query params (JSON)</span>
                <textarea
                  value={queryParamsInput}
                  onChange={(event) => onQueryParamsChange(event.target.value)}
                  rows={5}
                  spellCheck={false}
                />
              </label>
            </div>
          ) : null}

          {tab === "headers" ? (
            <label className="tryout-code-field tryout-code-field--full">
              <span>Headers (JSON)</span>
              <textarea
                value={headersInput}
                onChange={(event) => onHeadersChange(event.target.value)}
                rows={8}
                spellCheck={false}
              />
            </label>
          ) : null}

          {tab === "body" ? (
            canSendBody ? (
              <label className="tryout-code-field tryout-code-field--full">
                <div className="tryout-body-head">
                  <span>Request body</span>
                  {hasBodySchema ? (
                    <span className="tryout-body-actions">
                      {onFillEmptyBody ? (
                        <button type="button" className="tryout-ghost-btn" onClick={onFillEmptyBody}>
                          Empty template
                        </button>
                      ) : null}
                      {onFillExampleBody ? (
                        <button type="button" className="tryout-ghost-btn" onClick={onFillExampleBody}>
                          Example template
                        </button>
                      ) : null}
                    </span>
                  ) : null}
                </div>
                <textarea
                  value={requestBody}
                  onChange={(event) => onRequestBodyChange(event.target.value)}
                  rows={10}
                  spellCheck={false}
                  placeholder='{"key": "value"}'
                />
              </label>
            ) : (
              <p className="empty-message">{method} requests do not include a body.</p>
            )
          ) : null}

          {tab === "auth" ? (
            <div className="tryout-auth-panel">
              <label className="tryout-inline-field">
                <span>Auth type</span>
                <select value={authType} onChange={(event) => onAuthTypeChange(event.target.value as AuthType)}>
                  <option value="none">None</option>
                  <option value="bearer">Bearer token</option>
                  <option value="basic">Basic (base64)</option>
                  <option value="api-key">API key</option>
                </select>
              </label>
              {authType === "api-key" ? (
                <label className="tryout-inline-field">
                  <span>Header name</span>
                  <input
                    value={authKeyName}
                    onChange={(event) => onAuthKeyNameChange(event.target.value)}
                    placeholder="X-API-Key"
                  />
                </label>
              ) : null}
              {authType !== "none" ? (
                <label className="tryout-inline-field">
                  <span>
                    {authType === "bearer"
                      ? "Token"
                      : authType === "basic"
                        ? "Credentials (base64)"
                        : "API key value"}
                  </span>
                  <input
                    type="password"
                    value={authValue}
                    onChange={(event) => onAuthValueChange(event.target.value)}
                    placeholder={authType === "bearer" ? "eyJ…" : "••••••"}
                  />
                </label>
              ) : null}
              {activeEnv ? (
                <p className="tryout-env-hint">
                  Tip: use <code>{`{{varName}}`}</code> in URL, headers, or body — resolved from{" "}
                  <strong>{activeEnv.name}</strong>.
                </p>
              ) : null}
            </div>
          ) : null}

          {tab === "saved" ? (
            <SavedExchangesPanel
              exchanges={savedExchanges}
              onLoad={(exchange) => onLoadExchange?.(exchange)}
              onDelete={(id) => onDeleteExchange?.(id)}
            />
          ) : null}
      </div>

      {requestError ? <p className="tryout-error">{requestError}</p> : null}

      <div className={`tryout-response ${hasResponse ? "tryout-response--active" : ""}`}>
        <div className="tryout-response-head">
          <span className="tryout-response-title">Response</span>
          <div className="tryout-response-meta">
            {requestStatus ? (
              <span className={statusBadgeClass(requestStatus)}>{requestStatus}</span>
            ) : (
              <span className="tryout-response-placeholder">—</span>
            )}
            {requestTiming !== null ? (
              <span className="tryout-timing">{requestTiming} ms</span>
            ) : null}
            {requestResponse ? (
              <>
                <button
                  type="button"
                  className="tryout-ghost-btn"
                  onClick={() => void copyText(requestResponse, "response")}
                >
                  {copied === "response" ? "Copied" : "Copy body"}
                </button>
                {onSaveExchange ? (
                  <button type="button" className="tryout-ghost-btn" onClick={onSaveExchange}>
                    Save
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        {Object.keys(requestHeaders).length > 0 ? (
          <details className="tryout-response-headers" open={showHeadersOpen}>
            <summary>Headers ({Object.keys(requestHeaders).length})</summary>
            <div className="tryout-headers-table-wrap">
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
            </div>
          </details>
        ) : null}

        <pre
          className={`tryout-response-body${responseDisplay.placeholder ? " tryout-response-body--placeholder" : ""}`}
        >
          {responseDisplay.text}
        </pre>
      </div>
    </article>
  );
}
