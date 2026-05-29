import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { prettyResponseBody } from "./tryout-utils";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

interface JsonResponseViewerProps {
  body: string;
  placeholder?: boolean;
  placeholderText?: string;
}

function parseJsonBody(raw: string): { ok: true; value: JsonValue } | { ok: false; text: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, text: raw };
  try {
    return { ok: true, value: JSON.parse(trimmed) as JsonValue };
  } catch {
    return { ok: false, text: raw };
  }
}

function valueKind(value: JsonValue): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function valueMatchesSearch(value: JsonValue, query: string): boolean {
  if (!query) return true;
  const hay = JSON.stringify(value).toLowerCase();
  return hay.includes(query);
}

function nodeMatchesSearch(value: JsonValue, query: string): boolean {
  if (!query) return true;
  if (valueMatchesSearch(value, query)) return true;
  if (Array.isArray(value)) {
    return value.some((item) => nodeMatchesSearch(item, query));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).some(
      ([key, val]) => key.toLowerCase().includes(query) || nodeMatchesSearch(val, query)
    );
  }
  return false;
}

function highlightText(text: string, query: string): ReactNode {
  if (!query) return text;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="json-viewer-mark">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

interface JsonNodeProps {
  name?: string;
  value: JsonValue;
  depth: number;
  path: string;
  search: string;
  defaultExpanded: boolean;
}

function JsonNode({ name, value, depth, path, search, defaultExpanded }: JsonNodeProps) {
  const kind = valueKind(value);
  const isContainer = kind === "object" || kind === "array";
  const childCount = isContainer
    ? kind === "array"
      ? (value as JsonValue[]).length
      : Object.keys(value as Record<string, JsonValue>).length
    : 0;
  const matches = nodeMatchesSearch(value, search);
  const [expanded, setExpanded] = useState(defaultExpanded || Boolean(search));

  useEffect(() => {
    if (search) setExpanded(true);
  }, [search]);

  if (!matches) return null;

  if (!isContainer) {
    return (
      <div className="json-viewer-line" style={{ paddingLeft: `${depth * 14}px` }}>
        {name !== undefined ? (
          /^\d+$/.test(name) ? (
            <span className="json-viewer-index">{highlightText(name, search)}</span>
          ) : (
            <>
              <span className="json-viewer-key">&quot;{highlightText(name, search)}&quot;</span>
              <span className="json-viewer-colon">: </span>
            </>
          )
        ) : null}
        {name !== undefined && /^\d+$/.test(name) ? (
          <span className="json-viewer-colon">: </span>
        ) : null}
        <span className={`json-viewer-value json-viewer-value--${kind}`}>
          {kind === "string" ? (
            <>
              &quot;{highlightText(String(value), search)}&quot;
            </>
          ) : (
            highlightText(String(value), search)
          )}
        </span>
      </div>
    );
  }

  const entries: [string, JsonValue][] =
    kind === "array"
      ? (value as JsonValue[]).map((item, index) => [String(index), item])
      : Object.entries(value as Record<string, JsonValue>);

  const preview =
    kind === "array"
      ? `[${childCount}]`
      : `{${childCount}}`;

  return (
    <div className="json-viewer-node">
      <div className="json-viewer-line json-viewer-line--branch" style={{ paddingLeft: `${depth * 14}px` }}>
        <button
          type="button"
          className="json-viewer-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? "▾" : "▸"}
        </button>
        {name !== undefined ? (
          /^\d+$/.test(name) ? (
            <span className="json-viewer-index">{highlightText(name, search)}</span>
          ) : (
            <>
              <span className="json-viewer-key">&quot;{highlightText(name, search)}&quot;</span>
              <span className="json-viewer-colon">: </span>
            </>
          )
        ) : null}
        {name !== undefined && /^\d+$/.test(name) ? (
          <span className="json-viewer-colon">: </span>
        ) : null}
        <span className={`json-viewer-bracket json-viewer-bracket--${kind}`}>
          {kind === "array" ? "[" : "{"}
        </span>
        {!expanded ? (
          <span className="json-viewer-preview">
            {preview}
            <span className={`json-viewer-bracket json-viewer-bracket--${kind}`}>
              {kind === "array" ? "]" : "}"}
            </span>
          </span>
        ) : null}
      </div>
      {expanded ? (
        <>
          {entries.map(([key, child]) => (
            <JsonNode
              key={`${path}.${key}`}
              name={key}
              value={child}
              depth={depth + 1}
              path={`${path}.${key}`}
              search={search}
              defaultExpanded={depth < 1}
            />
          ))}
          {kind === "array" && entries.length === 0 ? (
            <div className="json-viewer-line json-viewer-line--empty" style={{ paddingLeft: `${(depth + 1) * 14}px` }}>
              <span className="json-viewer-muted">empty</span>
            </div>
          ) : null}
          {kind === "object" && entries.length === 0 ? (
            <div className="json-viewer-line json-viewer-line--empty" style={{ paddingLeft: `${(depth + 1) * 14}px` }}>
              <span className="json-viewer-muted">empty</span>
            </div>
          ) : null}
          <div className="json-viewer-line" style={{ paddingLeft: `${depth * 14}px` }}>
            <span className={`json-viewer-bracket json-viewer-bracket--${kind}`}>
              {kind === "array" ? "]" : "}"}
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function JsonResponseViewer({ body, placeholder, placeholderText }: JsonResponseViewerProps) {
  const [search, setSearch] = useState("");
  const [expandAll, setExpandAll] = useState(true);

  const parsed = useMemo(() => parseJsonBody(prettyResponseBody(body)), [body]);
  const query = search.trim().toLowerCase();

  const expandCollapseAll = useCallback(() => {
    setExpandAll((v) => !v);
  }, []);

  if (placeholder) {
    return (
      <pre className="tryout-response-body tryout-response-body--placeholder">
        {placeholderText ?? body}
      </pre>
    );
  }

  if (!parsed.ok) {
    return (
      <div className="json-viewer">
        <div className="json-viewer-toolbar">
          <input
            type="search"
            className="json-viewer-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search response…"
            aria-label="Search response"
          />
        </div>
        <pre className="tryout-response-body json-viewer-raw">
          {query
            ? parsed.text
                .split("\n")
                .filter((line) => line.toLowerCase().includes(query))
                .join("\n") || "No matches."
            : parsed.text}
        </pre>
      </div>
    );
  }

  return (
    <div className="json-viewer">
      <div className="json-viewer-toolbar">
        <input
          type="search"
          className="json-viewer-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search keys or values…"
          aria-label="Search JSON response"
        />
        <button type="button" className="tryout-ghost-btn" onClick={expandCollapseAll}>
          {expandAll ? "Collapse all" : "Expand all"}
        </button>
      </div>
      <div className="json-viewer-tree tryout-response-body" key={expandAll ? "expanded" : "collapsed"}>
        <JsonNode
          value={parsed.value}
          depth={0}
          path="root"
          search={query}
          defaultExpanded={expandAll}
        />
      </div>
    </div>
  );
}
