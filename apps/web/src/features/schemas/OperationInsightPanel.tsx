import { useMemo, useState } from "react";
import type { OperationItem, UsedSchemaDetail } from "@/features/spec/spec-utils";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { getOperationPayloads, getPrimaryRequestBodySchema } from "./operation-payloads";
import {
  buildSchemaTree,
  sampleToJson,
  type SampleMode
} from "./schema-samples";
import { SchemaTreeView } from "./SchemaTreeView";

function methodTone(method: string): string {
  if (method === "GET") return "method-badge method-get";
  if (method === "POST") return "method-badge method-post";
  if (method === "DELETE") return "method-badge method-delete";
  if (method === "PUT" || method === "PATCH") return "method-badge method-put";
  return "method-badge method-default";
}

function statusTone(status: string): string {
  const code = Number(status);
  if (code >= 200 && code < 300) return "schema-status-pill schema-status-2xx";
  if (code >= 400 && code < 500) return "schema-status-pill schema-status-4xx";
  if (code >= 500) return "schema-status-pill schema-status-5xx";
  return "schema-status-pill";
}

interface OperationInsightPanelProps {
  spec: Record<string, unknown>;
  operation: OperationItem;
  usedSchemas: UsedSchemaDetail[];
  onApplyRequestBody?: (json: string) => void;
}

export function OperationInsightPanel({
  spec,
  operation,
  usedSchemas,
  onApplyRequestBody
}: OperationInsightPanelProps) {
  const payloads = useMemo(
    () => getOperationPayloads(spec, operation),
    [spec, operation]
  );

  const [requestTab, setRequestTab] = useState(0);
  const [responseTab, setResponseTab] = useState(0);
  const [sampleMode, setSampleMode] = useState<SampleMode>("empty");

  const activeRequest = payloads.requestBodies[requestTab] ?? null;
  const activeResponse = payloads.responses[responseTab] ?? null;

  const requestSample = useMemo(() => {
    if (!activeRequest?.schema) return "";
    return sampleToJson(spec, activeRequest.schema, sampleMode);
  }, [activeRequest?.schema, sampleMode, spec]);

  const responseSample = useMemo(() => {
    if (!activeResponse?.schema) return "";
    return sampleToJson(spec, activeResponse.schema, sampleMode);
  }, [activeResponse?.schema, sampleMode, spec]);

  const requestTree = useMemo(() => {
    if (!activeRequest?.schema) return [];
    return buildSchemaTree(spec, activeRequest.schema);
  }, [activeRequest?.schema, spec]);

  const responseTree = useMemo(() => {
    if (!activeResponse?.schema) return [];
    return buildSchemaTree(spec, activeResponse.schema);
  }, [activeResponse?.schema, spec]);

  const primaryBodySchema = useMemo(() => getPrimaryRequestBodySchema(payloads), [payloads]);

  return (
    <aside className="operation-insight-panel" aria-label="Operation reference">
      <section className="insight-hero">
        <div className="insight-hero-top">
          <span className={methodTone(operation.method)}>{operation.method}</span>
          {operation.tags.map((tag) => (
            <Badge key={tag} tone="default">
              {tag}
            </Badge>
          ))}
        </div>
        <h2 className="insight-path">{operation.path}</h2>
        <p className="insight-summary">{operation.summary}</p>
        {operation.description ? (
          <p className="insight-description">{operation.description}</p>
        ) : null}
        <dl className="insight-meta">
          {operation.operationId ? (
            <>
              <dt>Operation ID</dt>
              <dd>{operation.operationId}</dd>
            </>
          ) : null}
          <dt>Parameters</dt>
          <dd>{operation.parameters.length}</dd>
        </dl>
      </section>

      {payloads.parameters.length > 0 ? (
        <section className="insight-section">
          <h3 className="insight-section-title">Parameters</h3>
          <div className="insight-param-grid">
            {payloads.parameters.map((param) => (
              <div key={`${param.in}-${param.name}`} className="insight-param-card">
                <span className="insight-param-in">{param.in}</span>
                <span className="insight-param-name">{param.name}</span>
                <span className="insight-param-type">{param.type}</span>
                {param.required ? <span className="insight-required">required</span> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="insight-section">
        <div className="insight-section-head">
          <h3 className="insight-section-title">Payload templates</h3>
          <div className="insight-sample-toggle" role="group" aria-label="Sample mode">
            <button
              type="button"
              className={sampleMode === "empty" ? "active" : ""}
              onClick={() => setSampleMode("empty")}
            >
              Empty
            </button>
            <button
              type="button"
              className={sampleMode === "example" ? "active" : ""}
              onClick={() => setSampleMode("example")}
            >
              Example
            </button>
          </div>
        </div>
        <p className="insight-hint">
          Generated from the OpenAPI schema — empty uses type defaults; example prefers
          spec examples and enums.
        </p>
      </section>

      {payloads.requestBodies.length > 0 ? (
        <section className="insight-section">
          <h3 className="insight-section-title">Request body</h3>
          <div className="insight-tabs">
            {payloads.requestBodies.map((body, index) => (
              <button
                key={body.id}
                type="button"
                className={index === requestTab ? "active" : ""}
                onClick={() => setRequestTab(index)}
              >
                {body.mediaType ?? "body"}
              </button>
            ))}
          </div>
          {activeRequest ? (
            <>
              {activeRequest.description ? (
                <p className="insight-slot-desc">{activeRequest.description}</p>
              ) : null}
              <div className="insight-schema-layout">
                <div className="insight-schema-structure">
                  <h4>Structure</h4>
                  <SchemaTreeView nodes={requestTree} />
                </div>
                <div className="insight-schema-sample">
                  <div className="insight-sample-head">
                    <h4>JSON payload</h4>
                    {onApplyRequestBody && requestSample ? (
                      <Button
                        variant="secondary"
                        onClick={() => onApplyRequestBody(requestSample)}
                      >
                        Use in request
                      </Button>
                    ) : null}
                  </div>
                  <pre className="insight-json-preview">{requestSample || "{}"}</pre>
                </div>
              </div>
            </>
          ) : null}
        </section>
      ) : primaryBodySchema === null && !["GET", "HEAD"].includes(operation.method) ? (
        <section className="insight-section">
          <p className="insight-empty">No request body schema declared for this operation.</p>
        </section>
      ) : null}

      {payloads.responses.length > 0 ? (
        <section className="insight-section">
          <h3 className="insight-section-title">Responses</h3>
          <div className="insight-tabs">
            {payloads.responses.map((res, index) => (
              <button
                key={res.id}
                type="button"
                className={index === responseTab ? "active" : ""}
                onClick={() => setResponseTab(index)}
              >
                <span className={statusTone(res.statusCode ?? "")}>{res.statusCode}</span>
              </button>
            ))}
          </div>
          {activeResponse ? (
            <>
              <p className="insight-slot-desc">{activeResponse.description}</p>
              <div className="insight-schema-layout insight-schema-layout--compact">
                <div className="insight-schema-structure">
                  <h4>Structure</h4>
                  <SchemaTreeView nodes={responseTree} />
                </div>
                <div className="insight-schema-sample">
                  <h4>Sample response</h4>
                  <pre className="insight-json-preview">{responseSample || "{}"}</pre>
                </div>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {usedSchemas.length > 0 ? (
        <section className="insight-section">
          <h3 className="insight-section-title">Referenced schemas</h3>
          <div className="insight-schema-cards">
            {usedSchemas.map((schema) => (
              <details key={`${schema.source}-${schema.name}`} className="insight-schema-card">
                <summary>
                  <span className="insight-card-name">{schema.name}</span>
                  <span className="insight-card-type">{schema.type}</span>
                  <span className="insight-card-source">{schema.source}</span>
                </summary>
                {schema.description ? <p>{schema.description}</p> : null}
                {schema.propertyMeta.length > 0 ? (
                  <ul className="insight-card-props">
                    {schema.propertyMeta.map((field) => (
                      <li key={field.name}>
                        <code>{field.name}</code>
                        <span>{field.type}</span>
                        {field.required ? <em>required</em> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </details>
            ))}
          </div>
        </section>
      ) : null}
    </aside>
  );
}
