import { useMemo, useState } from "react";
import type { OperationItem } from "@/features/spec/spec-utils";
import { operationKey } from "@/features/spec/spec-utils";
import { scaffoldFromParameters } from "@/features/tryout/tryout-utils";
import type { AuthConfig } from "@/features/tryout/tryout-utils";
import type { Environment } from "@/features/environments/env-types";
import { runWorkflow } from "./run-workflow";
import type { useWorkflows } from "./use-workflows";
import type { WorkflowRunMode, WorkflowStepResult } from "./workflow-types";

type WorkflowsApi = ReturnType<typeof useWorkflows>;

interface WorkflowsViewProps {
  specLoaded: boolean;
  operations: OperationItem[];
  serverUrl: string;
  useProxy: boolean;
  proxyUrl: string;
  activeEnv: Environment | null;
  auth: AuthConfig;
  workflowsApi: WorkflowsApi;
  onImportSpec: () => void;
}

function methodTone(method: string): string {
  if (method === "GET") return "method-badge method-get";
  if (method === "POST") return "method-badge method-post";
  if (method === "DELETE") return "method-badge method-delete";
  return "method-badge method-default";
}

function fmtRecord(obj: Record<string, string>): string {
  return Object.keys(obj).length > 0 ? JSON.stringify(obj, null, 2) : "{}";
}

export function WorkflowsView({
  specLoaded,
  operations,
  serverUrl,
  useProxy,
  proxyUrl,
  activeEnv,
  auth,
  workflowsApi,
  onImportSpec,
}: WorkflowsViewProps) {
  const {
    workflows,
    activeWorkflowId,
    activeWorkflow,
    setActiveWorkflowId,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    addStep,
    updateStep,
    removeStep,
    moveStep,
    setRunMode,
  } = workflowsApi;

  const [addOperationKey, setAddOperationKey] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [runResults, setRunResults] = useState<WorkflowStepResult[]>([]);
  const [runError, setRunError] = useState("");

  const operationByKey = useMemo(() => {
    const map = new Map<string, OperationItem>();
    operations.forEach((op) => map.set(operationKey(op), op));
    return map;
  }, [operations]);

  function handleCreateWorkflow() {
    const name = window.prompt("Workflow name", "New workflow");
    if (!name?.trim()) {
      return;
    }
    createWorkflow(name.trim());
  }

  function handleAddStep() {
    if (!activeWorkflow || !addOperationKey) {
      return;
    }

    const operation = operationByKey.get(addOperationKey);
    if (!operation) {
      return;
    }

    const { pathParams, queryParams, headers } = scaffoldFromParameters(operation.parameters);
    addStep(activeWorkflow.id, {
      operationKey: addOperationKey,
      method: operation.method,
      path: operation.path,
      summary: operation.summary,
      pathParamsJson: fmtRecord(pathParams),
      queryParamsJson: fmtRecord(queryParams),
      headersJson: fmtRecord(headers),
      requestBody: "",
    });
    setAddOperationKey("");
  }

  async function handleRunWorkflow() {
    if (!activeWorkflow || activeWorkflow.steps.length === 0) {
      setRunError("Add at least one step before running.");
      return;
    }

    setRunError("");
    setIsRunning(true);
    setRunResults([]);

    try {
      const results = await runWorkflow(activeWorkflow.steps, activeWorkflow.runMode, {
        serverUrl,
        useProxy,
        proxyUrl,
        auth,
        variables: activeEnv?.variables ?? {},
      });
      setRunResults(results);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Workflow run failed.");
    } finally {
      setIsRunning(false);
    }
  }

  if (!specLoaded) {
    return (
      <div className="content-pane workflows-pane">
        <article className="detail-card">
          <h2>Workflows</h2>
          <p className="empty-message">
            Load an OpenAPI spec to build multi-step API flows. Each workflow chains endpoints with
            prefilled request forms and runs them in order.
          </p>
          <button type="button" className="import-btn" onClick={onImportSpec}>
            Import Spec
          </button>
        </article>
      </div>
    );
  }

  return (
    <div className="content-pane workflows-pane">
      <div className="workflows-layout">
        <aside className="workflows-list-pane">
          <div className="workflows-list-head">
            <h2>Workflows</h2>
            <button type="button" onClick={handleCreateWorkflow}>
              New
            </button>
          </div>

          {workflows.length === 0 ? (
            <p className="empty-message">No workflows yet. Create one to chain API calls.</p>
          ) : (
            <div className="workflows-list">
              {workflows.map((workflow) => (
                <button
                  key={workflow.id}
                  type="button"
                  className={`workflow-list-item ${activeWorkflowId === workflow.id ? "active" : ""}`}
                  onClick={() => setActiveWorkflowId(workflow.id)}
                >
                  <span className="workflow-list-name">{workflow.name}</span>
                  <span className="workflow-list-meta">{workflow.steps.length} steps</span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="workflows-editor-pane">
          {!activeWorkflow ? (
            <p className="empty-message">Select or create a workflow.</p>
          ) : (
            <>
              <article className="detail-card">
                <div className="workflows-editor-head">
                  <label className="workflow-name-field">
                    <span>Name</span>
                    <input
                      value={activeWorkflow.name}
                      onChange={(event) => updateWorkflow(activeWorkflow.id, { name: event.target.value })}
                    />
                  </label>
                  <label className="workflow-run-mode-field">
                    <span>Run mode</span>
                    <select
                      value={activeWorkflow.runMode}
                      onChange={(event) => setRunMode(activeWorkflow.id, event.target.value as WorkflowRunMode)}
                    >
                      <option value="serial">Serial (run all steps)</option>
                      <option value="stop-on-error">Stop on first failure</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      if (window.confirm(`Delete workflow "${activeWorkflow.name}"?`)) {
                        deleteWorkflow(activeWorkflow.id);
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>

                <p className="text-muted">
                  Add API steps in order. Drag-and-drop ordering comes next; use ↑ ↓ for now.
                </p>

                <div className="workflow-add-step">
                  <select
                    value={addOperationKey}
                    onChange={(event) => setAddOperationKey(event.target.value)}
                    aria-label="Endpoint to add"
                  >
                    <option value="">Add endpoint step…</option>
                    {operations.map((operation) => {
                      const key = operationKey(operation);
                      return (
                        <option key={key} value={key}>
                          {operation.method} {operation.path} — {operation.summary}
                        </option>
                      );
                    })}
                  </select>
                  <button type="button" onClick={handleAddStep} disabled={!addOperationKey}>
                    Add step
                  </button>
                </div>

                <div className="workflow-steps">
                  {activeWorkflow.steps.length === 0 ? (
                    <p className="empty-message">No steps yet. Pick an endpoint above.</p>
                  ) : (
                    activeWorkflow.steps.map((step, index) => (
                      <details key={step.id} className="workflow-step-card" open={index === 0}>
                        <summary className="workflow-step-summary">
                          <span className={methodTone(step.method)}>{step.method}</span>
                          <span className="workflow-step-path">{step.path}</span>
                          <span className="workflow-step-actions">
                            <button
                              type="button"
                              className="workflow-step-move"
                              disabled={index === 0}
                              onClick={(event) => {
                                event.preventDefault();
                                moveStep(activeWorkflow.id, step.id, -1);
                              }}
                              aria-label="Move step up"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="workflow-step-move"
                              disabled={index === activeWorkflow.steps.length - 1}
                              onClick={(event) => {
                                event.preventDefault();
                                moveStep(activeWorkflow.id, step.id, 1);
                              }}
                              aria-label="Move step down"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              className="workflow-step-remove"
                              onClick={(event) => {
                                event.preventDefault();
                                removeStep(activeWorkflow.id, step.id);
                              }}
                            >
                              Remove
                            </button>
                          </span>
                        </summary>
                        <div className="workflow-step-body tryout-grid">
                          <label>
                            <span>Path Params JSON</span>
                            <textarea
                              rows={3}
                              value={step.pathParamsJson}
                              onChange={(event) => updateStep(activeWorkflow.id, step.id, {
                                pathParamsJson: event.target.value,
                              })}
                            />
                          </label>
                          <label>
                            <span>Query Params JSON</span>
                            <textarea
                              rows={3}
                              value={step.queryParamsJson}
                              onChange={(event) => updateStep(activeWorkflow.id, step.id, {
                                queryParamsJson: event.target.value,
                              })}
                            />
                          </label>
                          <label>
                            <span>Headers JSON</span>
                            <textarea
                              rows={3}
                              value={step.headersJson}
                              onChange={(event) => updateStep(activeWorkflow.id, step.id, {
                                headersJson: event.target.value,
                              })}
                            />
                          </label>
                          <label>
                            <span>Request Body</span>
                            <textarea
                              rows={4}
                              value={step.requestBody}
                              onChange={(event) => updateStep(activeWorkflow.id, step.id, {
                                requestBody: event.target.value,
                              })}
                            />
                          </label>
                        </div>
                      </details>
                    ))
                  )}
                </div>

                <button
                  type="button"
                  className="workflow-run-btn"
                  onClick={() => void handleRunWorkflow()}
                  disabled={isRunning || activeWorkflow.steps.length === 0}
                >
                  {isRunning ? "Running…" : "Run workflow"}
                </button>
                {runError ? <p className="error">{runError}</p> : null}
              </article>

              {runResults.length > 0 ? (
                <article className="detail-card">
                  <h3>Run results</h3>
                  <ul className="workflow-run-results">
                    {runResults.map((result, index) => {
                      const step = activeWorkflow.steps.find((s) => s.id === result.stepId);
                      return (
                        <li key={result.stepId} className={`workflow-run-item ${result.ok ? "ok" : "fail"}`}>
                          <div className="workflow-run-item-head">
                            <span>Step {index + 1}</span>
                            {step ? (
                              <span className={methodTone(step.method)}>{step.method}</span>
                            ) : null}
                            <span>{result.status ?? "—"}</span>
                            <span>{result.durationMs} ms</span>
                          </div>
                          {result.error ? <p className="error">{result.error}</p> : null}
                          {result.responseBody ? (
                            <pre className="workflow-run-body">{result.responseBody.slice(0, 2000)}</pre>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </article>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
