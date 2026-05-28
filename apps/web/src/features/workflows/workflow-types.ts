export type WorkflowRunMode = "serial" | "stop-on-error";

export interface WorkflowStep {
  id: string;
  operationKey: string;
  /** Preferred reference when using collection-backed requests */
  savedRequestId?: string;
  method: string;
  path: string;
  summary: string;
  pathParamsJson: string;
  queryParamsJson: string;
  headersJson: string;
  requestBody: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  runMode: WorkflowRunMode;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStepResult {
  stepId: string;
  operationKey: string;
  ok: boolean;
  status?: number;
  durationMs: number;
  responseBody: string;
  error?: string;
}
