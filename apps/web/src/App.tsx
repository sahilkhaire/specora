import { useMemo, useState } from "react";
import {
  detectDefaultServerUrl,
  extractOperations,
  filterOperations,
  parseSpecText,
  operationKey
} from "./spec-utils";
import { buildRequestUrl, safeParseRecord } from "./tryout-utils";

export function App() {
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
  const [requestTiming, setRequestTiming] = useState<number | null>(null);
  const [requestError, setRequestError] = useState("");
  const [isSending, setIsSending] = useState(false);

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

    const targetUrl = buildRequestUrl({
      baseUrl: serverUrl,
      endpointPath: selectedOperation.path,
      pathParams: parsedPath.data,
      queryParams: parsedQuery.data
    });

    const method = selectedOperation.method;
    const canSendBody = !["GET", "HEAD"].includes(method);
    const body = canSendBody && requestBody.trim() ? requestBody : undefined;
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
            headers: parsedHeaders.data,
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
        setRequestResponse(payload.body || "");
      } else {
        const response = await fetch(targetUrl, {
          method,
          headers: parsedHeaders.data,
          body
        });

        const responseText = await response.text();
        setRequestStatus(`${response.status}`);
        setRequestResponse(responseText);
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
    <div className="page">
      <header className="hero">
        <h1>Specora</h1>
        <p>Modern OpenAPI documentation experience with URL, paste, and upload workflows.</p>
      </header>

      <section className="panel controls">
        <h2>Load Spec</h2>
        <div className="field-row">
          <input
            value={urlInput}
            onChange={(event) => setUrlInput(event.target.value)}
            placeholder="https://example.com/openapi.json"
          />
          <button onClick={loadFromUrl} disabled={isLoadingUrl}>
            {isLoadingUrl ? "Loading..." : "Load URL"}
          </button>
        </div>

        <div className="field-row">
          <input
            type="file"
            accept=".json,.yaml,.yml"
            onChange={(event) => void loadFromFile(event.target.files?.[0] ?? null)}
          />
        </div>

        <textarea
          value={rawInput}
          onChange={(event) => setRawInput(event.target.value)}
          placeholder="Paste OpenAPI JSON or YAML here"
          rows={12}
        />

        <button onClick={loadFromText}>Parse Pasted Spec</button>
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="panel summary">
        <h2>Summary</h2>
        {spec ? (
          <div>
            <p><strong>Title:</strong> {String(info.title ?? "Untitled API")}</p>
            <p><strong>Version:</strong> {String(info.version ?? "unknown")}</p>
            <p><strong>Total operations:</strong> {operations.length}</p>
            <p><strong>Visible operations:</strong> {filteredOperations.length}</p>
          </div>
        ) : (
          <p>No spec loaded yet.</p>
        )}
      </section>

      <section className="panel operations">
        <h2>Operations</h2>
        <div className="field-row">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by path, summary, or tag"
          />
          <select
            value={methodFilter}
            onChange={(event) => setMethodFilter(event.target.value)}
            className="method-select"
          >
            {methods.map((method) => (
              <option key={method} value={method}>{method}</option>
            ))}
          </select>
        </div>

        {filteredOperations.length > 0 ? (
          <ul>
            {filteredOperations.map((operation) => (
              <li
                key={operationKey(operation)}
                className={selectedOperation && operationKey(selectedOperation) === operationKey(operation) ? "active" : ""}
              >
                <button
                  className="operation-button"
                  type="button"
                  onClick={() => setSelectedOperationKey(operationKey(operation))}
                >
                <span className="method">{operation.method}</span>
                <span className="path">{operation.path}</span>
                <span className="summary">{operation.summary}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No operations match your current filters.</p>
        )}
      </section>

      <section className="panel operation-detail">
        <h2>Operation Detail</h2>
        {selectedOperation ? (
          <div>
            <p><strong>Method:</strong> {selectedOperation.method}</p>
            <p><strong>Path:</strong> {selectedOperation.path}</p>
            <p><strong>Summary:</strong> {selectedOperation.summary}</p>
            <p><strong>Operation ID:</strong> {selectedOperation.operationId || "N/A"}</p>
            <p><strong>Tags:</strong> {selectedOperation.tags.length ? selectedOperation.tags.join(", ") : "None"}</p>
            <p><strong>Parameters:</strong> {selectedOperation.parameters.length}</p>
            <p><strong>Request Body:</strong> {selectedOperation.requestBody ? "Present" : "None"}</p>
            {selectedOperation.description ? (
              <p><strong>Description:</strong> {selectedOperation.description}</p>
            ) : null}
          </div>
        ) : (
          <p>No operation selected.</p>
        )}
      </section>

      <section className="panel tryout">
        <h2>Try Out</h2>
        <div className="field-row">
          <input
            value={serverUrl}
            onChange={(event) => setServerUrl(event.target.value)}
            placeholder="https://api.example.com"
          />
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={useProxy}
            onChange={(event) => setUseProxy(event.target.checked)}
          />
          Use local proxy mode
        </label>

        {useProxy ? (
          <div className="field-row">
            <input
              value={proxyUrl}
              onChange={(event) => setProxyUrl(event.target.value)}
              placeholder="http://localhost:8787/proxy"
            />
          </div>
        ) : null}

        <div className="tryout-grid">
          <div>
            <label>Path Params (JSON object)</label>
            <textarea value={pathParamsInput} onChange={(event) => setPathParamsInput(event.target.value)} rows={3} />
          </div>
          <div>
            <label>Query Params (JSON object)</label>
            <textarea value={queryParamsInput} onChange={(event) => setQueryParamsInput(event.target.value)} rows={3} />
          </div>
          <div>
            <label>Headers (JSON object)</label>
            <textarea value={headersInput} onChange={(event) => setHeadersInput(event.target.value)} rows={3} />
          </div>
          <div>
            <label>Request Body</label>
            <textarea value={requestBody} onChange={(event) => setRequestBody(event.target.value)} rows={4} />
          </div>
        </div>

        <button type="button" onClick={sendRequest} disabled={!selectedOperation || isSending}>
          {isSending ? "Sending..." : "Send Request"}
        </button>

        {requestError ? <p className="error">{requestError}</p> : null}

        <div className="response-box">
          <p><strong>Status:</strong> {requestStatus || "N/A"}</p>
          <p><strong>Time:</strong> {requestTiming !== null ? `${requestTiming} ms` : "N/A"}</p>
          <pre>{requestResponse || "No response yet."}</pre>
        </div>
      </section>
    </div>
  );
}
