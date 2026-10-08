import { useEffect, useRef, useState } from "react";
import type { SpecSource } from "@/features/workspaces/workspace-types";
import { fetchSpecFromUrl, parseLoadedText, type LoadedSpec } from "./load-spec";

type LoadMode = "url" | "upload" | "paste";

interface SpecImportDialogProps {
  /** First-run prompt for an empty workspace: stronger copy, no click-outside dismiss. */
  required: boolean;
  initialSource: SpecSource | null;
  currentSpec: Record<string, unknown> | null;
  operationCount: number;
  onClose: () => void;
  onLoaded: (loaded: LoadedSpec, source: SpecSource) => void;
}

export function SpecImportDialog({
  required,
  initialSource,
  currentSpec,
  operationCount,
  onClose,
  onLoaded
}: SpecImportDialogProps) {
  const [mode, setMode] = useState<LoadMode>("url");
  const [urlInput, setUrlInput] = useState(initialSource?.type === "url" ? initialSource.value : "");
  const [rawInput, setRawInput] = useState(initialSource && initialSource.type !== "url" ? initialSource.value : "");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => urlInputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function load(action: () => Promise<{ loaded: LoadedSpec; source: SpecSource }>) {
    setError("");
    setIsLoading(true);
    action()
      .then(({ loaded, source }) => onLoaded(loaded, source))
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Failed to load spec."))
      .finally(() => setIsLoading(false));
  }

  function loadFromUrl() {
    const url = urlInput.trim();
    if (!url) {
      setError("Please provide a URL.");
      return;
    }
    load(async () => ({ loaded: await fetchSpecFromUrl(url), source: { type: "url", value: url } }));
  }

  function loadFromText() {
    load(async () => ({ loaded: parseLoadedText(rawInput), source: { type: "text", value: rawInput } }));
  }

  function loadFromFile(file: File | null) {
    if (!file) return;
    load(async () => {
      const text = await file.text();
      setRawInput(text);
      return { loaded: parseLoadedText(text), source: { type: "file", value: text, fileName: file.name } };
    });
  }

  const info = (currentSpec?.info as Record<string, unknown> | undefined) ?? {};
  const tabs: Array<{ id: LoadMode; label: string }> = [
    { id: "url", label: "URL" },
    { id: "upload", label: "Upload" },
    { id: "paste", label: "Paste" }
  ];

  return (
    <div
      className={`spec-loader-overlay${required ? " spec-loader-overlay--required" : ""}`}
      onClick={required ? undefined : onClose}
    >
      <div
        className="spec-loader-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="spec-import-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="spec-loader-header">
          <div>
            <h2 id="spec-import-title">{required ? "Add your API specification" : "Import Specification"}</h2>
            {required ? (
              <p className="spec-loader-lead">
                Load an OpenAPI or Swagger file to get started. It is saved to this workspace for next time.
              </p>
            ) : null}
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="spec-loader-content">
          <article className="panel-card">
            <h3>Load spec</h3>
            <div className="load-tabs" role="tablist" aria-label="Load mode">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={mode === tab.id}
                  className={mode === tab.id ? "active" : ""}
                  onClick={() => setMode(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {mode === "url" ? (
              <form
                className="stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  loadFromUrl();
                }}
              >
                <input
                  ref={urlInputRef}
                  type="url"
                  value={urlInput}
                  onChange={(event) => setUrlInput(event.target.value)}
                  placeholder="https://example.com/openapi.json"
                  aria-label="Spec URL"
                />
                <button type="submit" disabled={isLoading}>
                  {isLoading ? "Loading..." : "Load URL"}
                </button>
              </form>
            ) : null}

            {mode === "upload" ? (
              <div className="stack">
                <input
                  type="file"
                  accept=".json,.yaml,.yml"
                  aria-label="Spec file"
                  onChange={(event) => loadFromFile(event.target.files?.[0] ?? null)}
                />
              </div>
            ) : null}

            {mode === "paste" ? (
              <div className="stack">
                <textarea
                  value={rawInput}
                  onChange={(event) => setRawInput(event.target.value)}
                  placeholder="Paste OpenAPI JSON or YAML here"
                  rows={10}
                />
                <button type="button" onClick={loadFromText} disabled={isLoading}>
                  Parse Pasted Spec
                </button>
              </div>
            ) : null}

            {error ? (
              <p className="error" role="alert">
                {error}
              </p>
            ) : null}
          </article>

          <article className="panel-card summary-card">
            <div className="summary-head">
              <h3>Current spec</h3>
            </div>
            {currentSpec ? (
              <>
                <p>
                  <span>Title</span> {String(info.title ?? "Untitled API")}
                </p>
                <p>
                  <span>Version</span> {String(info.version ?? "unknown")}
                </p>
                <p>
                  <span>Operations</span> {operationCount}
                </p>
              </>
            ) : (
              <p className="empty-message">No spec loaded yet.</p>
            )}
          </article>
        </div>
      </div>
    </div>
  );
}
