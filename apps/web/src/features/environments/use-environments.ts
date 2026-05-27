import { useState, useEffect } from "react";
import type { Environment } from "./env-types";

function getEnvsKey(workspaceId: string): string {
  return `specora:workspaces:${workspaceId}:environments`;
}

function getActiveEnvKey(workspaceId: string): string {
  return `specora:workspaces:${workspaceId}:activeEnvId`;
}

function load(workspaceId: string | null): Environment[] {
  if (!workspaceId) return [];
  
  try {
    const raw = localStorage.getItem(getEnvsKey(workspaceId));
    return raw ? (JSON.parse(raw) as Environment[]) : [];
  } catch {
    return [];
  }
}

function persist(workspaceId: string | null, envs: Environment[]): void {
  if (!workspaceId) return;
  localStorage.setItem(getEnvsKey(workspaceId), JSON.stringify(envs));
}

function loadActiveEnvId(workspaceId: string | null): string {
  if (!workspaceId) return "";
  return localStorage.getItem(getActiveEnvKey(workspaceId)) ?? "";
}
workspaceId, updated);
  }

  function updateEnvironment(id: string, patch: Partial<Omit<Environment, "id">>): void {
    const updated = environments.map((e) => (e.id === id ? { ...e, ...patch } : e));
    setEnvironments(updated);
    persist(workspaceId, updated);
  }

  function deleteEnvironment(id: string): void {
    const updated = environments.filter((e) => e.id !== id);
    setEnvironments(updated);
    persist(workspaceId, updated);
    if (activeEnvId === id) {
      const next = updated[0]?.id ?? "";
      setActiveEnvId(next);
      persistActiveEnvId(workspaceId, next);
    }
  }

  /** Pass an empty string to clear the active environment. */
  function switchEnvironment(id: string): void {
    setActiveEnvId(id);
    persistActiveEnvId(workspaceId

  function updateEnvironment(id: string, patch: Partial<Omit<Environment, "id">>): void {
    const updated = environments.map((e) => (e.id === id ? { ...e, ...patch } : e));
    setEnvironments(updated);
    persist(updated);
  }

  function deleteEnvironment(id: string): void {
    const updated = environments.filter((e) => e.id !== id);
    setEnvironments(updated);
    persist(updated);
    if (activeEnvId === id) {
      const next = updated[0]?.id ?? "";
      setActiveEnvId(next);
      localStorage.setItem(ACTIVE_KEY, next);
    }
  }

  /** Pass an empty string to clear the active environment. */
  function switchEnvironment(id: string): void {
    setActiveEnvId(id);
    localStorage.setItem(ACTIVE_KEY, id);
  }

  return {
    environments,
    activeEnvId,
    activeEnv,
    createEnvironment,
    updateEnvironment,
    deleteEnvironment,
    switchEnvironment,
  };
}
