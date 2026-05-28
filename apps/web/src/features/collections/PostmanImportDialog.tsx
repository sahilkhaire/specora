import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import {
  detectPostmanFile,
  importPostmanCollection,
  importPostmanEnvironment,
  type NormalizedCollection
} from "@specora/import-postman";
import { Button } from "@/shared/ui/Button";
import type { CollectionNode, SavedRequest } from "./collection-types";

function mapToSpecora(collection: NormalizedCollection): {
  nodes: CollectionNode[];
  requests: SavedRequest[];
} {
  const nodes: CollectionNode[] = collection.folders.map((f) => ({
    id: f.id,
    kind: "folder" as const,
    name: f.name,
    parentId: f.parentId,
    sortOrder: f.sortOrder
  }));

  const requests: SavedRequest[] = collection.requests.map((r) => ({
    id: r.id,
    name: r.name,
    method: r.method,
    url: r.url,
    source: "postman" as const,
    pathParams: r.pathParams,
    queryParams: r.queryParams,
    headers: r.headers,
    body: r.body,
    authType: r.auth?.type === "api-key" ? "api-key" : r.auth?.type,
    authValue: r.auth?.value,
    authKeyName: r.auth?.keyName,
    description: r.description,
    updatedAt: new Date().toISOString()
  }));

  for (const r of collection.requests) {
    nodes.push({
      id: `node_${r.id}`,
      kind: "request",
      name: r.name,
      parentId: r.folderId,
      sortOrder: r.sortOrder,
      requestId: r.id
    });
  }

  return { nodes, requests };
}

interface PostmanImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportCollection: (nodes: CollectionNode[], requests: SavedRequest[]) => void;
  onImportEnvironment: (name: string, variables: Record<string, string>) => void;
}

export function PostmanImportDialog({
  open,
  onOpenChange,
  onImportCollection,
  onImportEnvironment
}: PostmanImportDialogProps) {
  const [report, setReport] = useState<string[]>([]);
  const [detectedLabel, setDetectedLabel] = useState("");

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        try {
          const raw = JSON.parse(String(reader.result));
          const detected = detectPostmanFile(raw);
          setDetectedLabel(detected.label);

          if (detected.kind === "environment") {
            const env = importPostmanEnvironment(raw);
            if (!env) {
              setReport(["Failed to parse environment file."]);
              return;
            }
            onImportEnvironment(env.name, env.variables);
            setReport([`Imported environment "${env.name}" with ${Object.keys(env.variables).length} variables.`]);
            return;
          }

          const collection = await importPostmanCollection(raw);
          if (!collection) {
            setReport(["Unrecognized Postman file."]);
            return;
          }

          const mapped = mapToSpecora(collection);
          onImportCollection(mapped.nodes, mapped.requests);
          setReport([
            `Imported collection "${collection.name}" (${collection.requests.length} requests).`,
            ...collection.warnings.map((w) => w.message)
          ]);
        } catch (error) {
          setReport([error instanceof Error ? error.message : "Invalid JSON file."]);
        }
      })();
    };
    reader.readAsText(file);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="ui-dialog-overlay" />
        <Dialog.Content className="ui-dialog-content">
          <Dialog.Title className="ui-dialog-title">Import Postman</Dialog.Title>
          <Dialog.Description className="ui-dialog-description">
            Supports Collection v1, v2.0, v2.1 and Environment JSON exports.
          </Dialog.Description>

          <label className="ui-dropzone">
            <input
              type="file"
              accept="application/json,.json"
              className="ui-dropzone-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            Drop a Postman export or click to browse
          </label>

          {detectedLabel ? <p className="ui-import-detected">Detected: {detectedLabel}</p> : null}

          {report.length > 0 ? (
            <ul className="ui-import-report">
              {report.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}

          <div className="ui-dialog-actions">
            <Dialog.Close asChild>
              <Button variant="secondary">Close</Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
