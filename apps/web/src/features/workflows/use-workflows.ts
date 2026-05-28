import { useCallback, useEffect, useState } from "react";
import type { Workflow, WorkflowRunMode, WorkflowStep } from "./workflow-types";

const STORAGE_PREFIX = "specora:workflows:";

function storageKey(workspaceId: string): string {
  return `${STORAGE_PREFIX}${workspaceId}`;
}

function load(workspaceId: string): Workflow[] {
  if (!workspaceId) {
    return [];
  }

  try {
    const raw = localStorage.getItem(storageKey(workspaceId));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is Workflow => {
      return Boolean(
        item
        && typeof item === "object"
        && typeof (item as Workflow).id === "string"
        && typeof (item as Workflow).name === "string"
        && Array.isArray((item as Workflow).steps)
      );
    });
  } catch {
    return [];
  }
}

function persist(workspaceId: string, workflows: Workflow[]): void {
  if (!workspaceId) {
    return;
  }

  try {
    localStorage.setItem(storageKey(workspaceId), JSON.stringify(workflows));
  } catch {
    // Keep UI usable when storage is unavailable.
  }
}

export function useWorkflows(workspaceId: string) {
  const [workflows, setWorkflows] = useState<Workflow[]>(() => load(workspaceId));
  const [activeWorkflowId, setActiveWorkflowId] = useState("");

  useEffect(() => {
    const next = load(workspaceId);
    setWorkflows(next);
    setActiveWorkflowId((current) => (next.some((w) => w.id === current) ? current : next[0]?.id ?? ""));
  }, [workspaceId]);

  const activeWorkflow = workflows.find((w) => w.id === activeWorkflowId) ?? null;

  const createWorkflow = useCallback((name: string, description?: string): string => {
    const now = new Date().toISOString();
    const workflow: Workflow = {
      id: crypto.randomUUID(),
      name,
      description,
      runMode: "serial",
      steps: [],
      createdAt: now,
      updatedAt: now,
    };

    setWorkflows((prev) => {
      const updated = [...prev, workflow];
      persist(workspaceId, updated);
      return updated;
    });
    setActiveWorkflowId(workflow.id);
    return workflow.id;
  }, [workspaceId]);

  const updateWorkflow = useCallback((
    id: string,
    patch: Partial<Pick<Workflow, "name" | "description" | "runMode" | "steps">>
  ): void => {
    setWorkflows((prev) => {
      const updated = prev.map((workflow) => {
        if (workflow.id !== id) {
          return workflow;
        }

        return {
          ...workflow,
          ...patch,
          updatedAt: new Date().toISOString(),
        };
      });
      persist(workspaceId, updated);
      return updated;
    });
  }, [workspaceId]);

  const deleteWorkflow = useCallback((id: string): void => {
    setWorkflows((prev) => {
      const updated = prev.filter((workflow) => workflow.id !== id);
      persist(workspaceId, updated);
      setActiveWorkflowId((current) => {
        if (current !== id) {
          return current;
        }
        return updated[0]?.id ?? "";
      });
      return updated;
    });
  }, [workspaceId]);

  const addStep = useCallback((workflowId: string, step: Omit<WorkflowStep, "id">): void => {
    const newStep: WorkflowStep = { id: crypto.randomUUID(), ...step };
    setWorkflows((prev) => {
      const updated = prev.map((workflow) => {
        if (workflow.id !== workflowId) {
          return workflow;
        }

        return {
          ...workflow,
          steps: [...workflow.steps, newStep],
          updatedAt: new Date().toISOString(),
        };
      });
      persist(workspaceId, updated);
      return updated;
    });
  }, [workspaceId]);

  const updateStep = useCallback((
    workflowId: string,
    stepId: string,
    patch: Partial<Omit<WorkflowStep, "id" | "operationKey" | "method" | "path" | "summary">>
  ): void => {
    setWorkflows((prev) => {
      const updated = prev.map((workflow) => {
        if (workflow.id !== workflowId) {
          return workflow;
        }

        return {
          ...workflow,
          steps: workflow.steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step)),
          updatedAt: new Date().toISOString(),
        };
      });
      persist(workspaceId, updated);
      return updated;
    });
  }, [workspaceId]);

  const removeStep = useCallback((workflowId: string, stepId: string): void => {
    setWorkflows((prev) => {
      const updated = prev.map((workflow) => {
        if (workflow.id !== workflowId) {
          return workflow;
        }

        return {
          ...workflow,
          steps: workflow.steps.filter((step) => step.id !== stepId),
          updatedAt: new Date().toISOString(),
        };
      });
      persist(workspaceId, updated);
      return updated;
    });
  }, [workspaceId]);

  const moveStep = useCallback((workflowId: string, stepId: string, direction: -1 | 1): void => {
    setWorkflows((prev) => {
      const updated = prev.map((workflow) => {
        if (workflow.id !== workflowId) {
          return workflow;
        }

        const index = workflow.steps.findIndex((step) => step.id === stepId);
        if (index < 0) {
          return workflow;
        }

        const target = index + direction;
        if (target < 0 || target >= workflow.steps.length) {
          return workflow;
        }

        const steps = [...workflow.steps];
        const [moved] = steps.splice(index, 1);
        steps.splice(target, 0, moved);

        return {
          ...workflow,
          steps,
          updatedAt: new Date().toISOString(),
        };
      });
      persist(workspaceId, updated);
      return updated;
    });
  }, [workspaceId]);

  const setRunMode = useCallback((workflowId: string, runMode: WorkflowRunMode): void => {
    updateWorkflow(workflowId, { runMode });
  }, [updateWorkflow]);

  return {
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
  };
}
