import { useCallback, useEffect, useState } from "react";
import { useDataContext } from "@/data/DataProvider";
import type { Workflow, WorkflowRunMode, WorkflowStep } from "./workflow-types";

export function useWorkflows(workspaceId: string) {
  const { stores } = useDataContext();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [activeWorkflowId, setActiveWorkflowId] = useState("");

  useEffect(() => {
    if (!workspaceId) {
      setWorkflows([]);
      setActiveWorkflowId("");
      return;
    }

    let cancelled = false;
    void (async () => {
      const list = await stores.workflows.list(workspaceId);
      if (cancelled) return;
      setWorkflows(list);
      setActiveWorkflowId((current) =>
        list.some((w) => w.id === current) ? current : (list[0]?.id ?? "")
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [stores, workspaceId]);

  const persist = useCallback(
    (next: Workflow[]) => {
      if (!workspaceId) return;
      setWorkflows(next);
      void stores.workflows.save(workspaceId, next);
    },
    [stores.workflows, workspaceId]
  );

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
    const next = [...workflows, workflow];
    setActiveWorkflowId(workflow.id);
    persist(next);
    return workflow.id;
  }, [workflows, persist]);

  const updateWorkflow = useCallback((
    id: string,
    patch: Partial<Pick<Workflow, "name" | "description" | "runMode" | "steps">>
  ): void => {
    persist(
      workflows.map((workflow) => {
        if (workflow.id !== id) return workflow;
        return { ...workflow, ...patch, updatedAt: new Date().toISOString() };
      })
    );
  }, [workflows, persist]);

  const deleteWorkflow = useCallback((id: string): void => {
    const next = workflows.filter((w) => w.id !== id);
    setActiveWorkflowId((current) => {
      if (current !== id) return current;
      return next[0]?.id ?? "";
    });
    persist(next);
  }, [workflows, persist]);

  const addStep = useCallback((workflowId: string, step: Omit<WorkflowStep, "id">): void => {
    const newStep: WorkflowStep = { id: crypto.randomUUID(), ...step };
    persist(
      workflows.map((workflow) => {
        if (workflow.id !== workflowId) return workflow;
        return {
          ...workflow,
          steps: [...workflow.steps, newStep],
          updatedAt: new Date().toISOString(),
        };
      })
    );
  }, [workflows, persist]);

  const updateStep = useCallback((
    workflowId: string,
    stepId: string,
    patch: Partial<Omit<WorkflowStep, "id" | "operationKey" | "method" | "path" | "summary">>
  ): void => {
    persist(
      workflows.map((workflow) => {
        if (workflow.id !== workflowId) return workflow;
        return {
          ...workflow,
          steps: workflow.steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step)),
          updatedAt: new Date().toISOString(),
        };
      })
    );
  }, [workflows, persist]);

  const removeStep = useCallback((workflowId: string, stepId: string): void => {
    persist(
      workflows.map((workflow) => {
        if (workflow.id !== workflowId) return workflow;
        return {
          ...workflow,
          steps: workflow.steps.filter((step) => step.id !== stepId),
          updatedAt: new Date().toISOString(),
        };
      })
    );
  }, [workflows, persist]);

  const moveStep = useCallback((workflowId: string, stepId: string, direction: -1 | 1): void => {
    persist(
      workflows.map((workflow) => {
        if (workflow.id !== workflowId) return workflow;
        const index = workflow.steps.findIndex((step) => step.id === stepId);
        if (index < 0) return workflow;
        const target = index + direction;
        if (target < 0 || target >= workflow.steps.length) return workflow;
        const steps = [...workflow.steps];
        const [moved] = steps.splice(index, 1);
        steps.splice(target, 0, moved);
        return { ...workflow, steps, updatedAt: new Date().toISOString() };
      })
    );
  }, [workflows, persist]);

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
