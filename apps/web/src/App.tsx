import { useMemo, useState } from "react";
import YAML from "yaml";

type ParseResult = {
  ok: true;
  spec: Record<string, unknown>;
} | {
  ok: false;
  error: string;
};

function parseSpecText(input: string): ParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: "Spec input is empty." };
  }

  try {
    const parsed = trimmed.startsWith("{") || trimmed.startsWith("[")
      ? JSON.parse(trimmed)
      : YAML.parse(trimmed);

    if (!parsed || typeof parsed !== "object") {
      return { ok: false, error: "Parsed spec is not a valid object." };
    }

    const maybeOpenapi = parsed as Record<string, unknown>;
    if (!maybeOpenapi.openapi && !maybeOpenapi.swagger) {
      return { ok: false, error: "Missing openapi/swagger version field." };
    }

    return { ok: true, spec: maybeOpenapi };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown parse error"
    };
  }
}

function extractOperations(spec: Record<string, unknown>) {
  const paths = (spec.paths as Record<string, unknown> | undefined) ?? {};
  const methods = new Set(["get", "post", "put", "patch", "delete", "options", "head"]);

  return Object.entries(paths).flatMap(([path, pathItem]) => {
    if (!pathItem || typeof pathItem !== "object") {
      return [];
    }

    return Object.entries(pathItem as Record<string, unknown>)
      .filter(([method]) => methods.has(method.toLowerCase()))
      .map(([method, operation]) => {
        const op = operation as Record<string, unknown>;
        const tags = Array.isArray(op.tags) ? op.tags.filter((tag): tag is string => typeof tag === "string") : [];

        return {
          method: method.toUpperCase(),
          path,
          summary: typeof op.summary === "string" ? op.summary : "No summary",
          operationId: typeof op.operationId === "string" ? op.operationId : "",
          tags,
          description: typeof op.description === "string" ? op.description : "",
          parameters: Array.isArray(op.parameters) ? op.parameters : [],
          requestBody: op.requestBody
        };
      });
  });
}

export function App() {
  const [rawInput, setRawInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [spec, setSpec] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string>("");
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [selectedOperationKey, setSelectedOperationKey] = useState("");

  const operations = useMemo(() => (spec ? extractOperations(spec) : []), [spec]);
  const filteredOperations = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return operations.filter((operation) => {
      const methodMatch = methodFilter === "ALL" || operation.method === methodFilter;
      const searchMatch = !query
        || operation.path.toLowerCase().includes(query)
        || operation.summary.toLowerCase().includes(query)
        || operation.tags.some((tag) => tag.toLowerCase().includes(query));

      return methodMatch && searchMatch;
    });
  }, [operations, searchTerm, methodFilter]);

  const selectedOperation = useMemo(() => {
    if (!selectedOperationKey) {
      return filteredOperations[0] ?? null;
    }

    return filteredOperations.find((operation) => {
      return `${operation.method}:${operation.path}:${operation.operationId}` === selectedOperationKey;
    }) ?? filteredOperations[0] ?? null;
  }, [filteredOperations, selectedOperationKey]);

  const methods = useMemo(() => {
    const unique = new Set(operations.map((operation) => operation.method));
    return ["ALL", ...Array.from(unique).sort()];
  }, [operations]);
  const info = (spec?.info as Record<string, unknown> | undefined) ?? {};

  function operationKey(operation: {
    method: string;
    path: string;
    operationId: string;
  }): string {
    return `${operation.method}:${operation.path}:${operation.operationId}`;
  }

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
    </div>
  );
}
