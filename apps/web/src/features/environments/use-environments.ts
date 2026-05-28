import { useState } from "react";
import type { Environment } from "./env-types";

const ENVS_KEY = "specora:environments";
const ACTIVE_KEY = "specora:activeEnvId";

function load(): Environment[] {
  try {
    const raw = localStorage.getItem(ENVS_KEY);
    return raw ? (JSON.parse(raw) as Environment[]) : [];
  } catch {
    return [];
  }
}

function persist(envs: Environment[]): void {
  localStorage.setItem(ENVS_KEY, JSON.stringify(envs));
}

export function useEnvironments() {
  const [environments, setEnvironments] = useState<Environment[]>(load);
  const [activeEnvId, setActiveEnvId] = useState<string>(() => {
    try { return localStorage.getItem(ACTIVE_KEY) ?? ""; } catch { return ""; }
  });

  const activeEnv = environments.find((e) => e.id === activeEnvId) ?? null;

  function createEnvironment(data: Omit<Environment, "id">): void {
    const newEnv: Environment = { id: crypto.randomUUID(), ...data };
    const updated = [...environments, newEnv];
    setEnvironments(updated);
    persist(updated);
  }

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
      try { localStorage.setItem(ACTIVE_KEY, next); } catch { /* noop */ }
    }
  }

  function switchEnvironment(id: string): void {
    setActiveEnvId(id);
    try { localStorage.setItem(ACTIVE_KEY, id); } catch { /* noop */ }
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
