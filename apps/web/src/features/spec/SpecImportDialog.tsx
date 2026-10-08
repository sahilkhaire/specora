import { useState } from "react";
import type { SpecSource } from "@/features/workspaces/workspace-types";
import { Button } from "@/shared/ui/Button";
import { Modal } from "@/shared/ui/Modal";
import { fetchSpecFromUrl, parseLoadedText, type LoadedSpec } from "./load-spec";
import { sampleSpecUrl } from "./sample-spec";

type LoadMode = "url" | "upload" | "paste";

const TABS: Array<{ id: LoadMode; label: string }> = [
  { id: "url", label: "URL" },
  { id: "upload", label: "Upload" },
  { id: "paste", label: "Paste" }
];

interface SpecImportDialogProps {
  /** First-run prompt for an empty workspace: welcoming copy, no click-outside dismiss. */
  required: boolean;
  initialSource: SpecSource | null;
  onClose: () => void;
  onLoaded: (loaded: LoadedSpec, source: SpecSource) => void;
}

export function SpecImportDialog({ required, initialSource, onClose, onLoaded }: SpecImportDialogProps) {
  const [mode, setMode] = useState<LoadMode>("url");
  const [urlInput, setUrlInput] = useState(initialSource?.type === "url" ? initialSource.value : "");
  const [rawInput, setRawInput] = useState(initialSource && initialSource.type !== "url" ? initialSource.value : "");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function load(action: () => Promise<{ loaded: LoadedSpec; source: SpecSource }>) {
    setError("");
    setIsLoading(true);
    action()
      .then(({ loaded, source }) => onLoaded(loaded, source))
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : "Failed to load spec."))
      .finally(() => setIsLoading(false));
  }

  function loadFromUrl(url: string) {
    if (!url) {
      setError("Please provide a URL.");
      return;
    }
    load(async () => ({ loaded: await fetchSpecFromUrl(url), source: { type: "url", value: url } }));
  }

  function loadFromFile(file: File | null) {
    if (!file) return;
    load(async () => {
      const text = await file.text();
      return { loaded: parseLoadedText(text), source: { type: "file", value: text, fileName: file.name } };
    });
  }

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={required ? "Add your API specification" : "Import specification"}
      description={
        required
          ? "Load an OpenAPI 3.x or Swagger 2.0 document. It is saved to this workspace for next time."
          : "Replace this workspace's spec. Saved requests are kept and matched to the new operations."
      }
      dismissOnOutsideClick={!required}
    >
      <div className="load-tabs" role="tablist" aria-label="Load mode">
        {TABS.map((tab) => (
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
            loadFromUrl(urlInput.trim());
          }}
        >
          <input
            autoFocus
            type="url"
            value={urlInput}
            onChange={(event) => setUrlInput(event.target.value)}
            placeholder="https://example.com/openapi.json"
            aria-label="Spec URL"
          />
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Loading…" : "Load URL"}
          </Button>
        </form>
      ) : null}

      {mode === "upload" ? (
        <label className="ui-dropzone">
          <span>Choose a .json, .yaml or .yml file</span>
          <input
            type="file"
            accept=".json,.yaml,.yml"
            aria-label="Spec file"
            onChange={(event) => loadFromFile(event.target.files?.[0] ?? null)}
          />
        </label>
      ) : null}

      {mode === "paste" ? (
        <div className="stack">
          <textarea
            value={rawInput}
            onChange={(event) => setRawInput(event.target.value)}
            placeholder="Paste OpenAPI JSON or YAML here"
            rows={10}
          />
          <Button
            disabled={isLoading}
            onClick={() =>
              load(async () => ({ loaded: parseLoadedText(rawInput), source: { type: "text", value: rawInput } }))
            }
          >
            Parse Pasted Spec
          </Button>
        </div>
      ) : null}

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      {required ? (
        <p className="spec-import-sample">
          No spec handy?{" "}
          <button type="button" className="link-button" disabled={isLoading} onClick={() => loadFromUrl(sampleSpecUrl())}>
            Try the Swagger Petstore sample
          </button>
        </p>
      ) : null}
    </Modal>
  );
}
