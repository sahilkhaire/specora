import { useCallback, useEffect, useState } from "react";
import { useDataContext } from "@/data/DataProvider";
import type { Environment } from "./env-types";

export function useEnvironments() {
  const { stores } = useDataContext();
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [activeEnvId, setActiveEnvId] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [list, activeId] = await Promise.all([
        stores.environments.list(),
        stores.environments.getActiveId(),
      ]);
      if (cancelled) return;
      setEnvironments(list);
      setActiveEnvId(activeId);
    })();
    return () => {
      cancelled = true;
    };
  }, [stores]);

  const persist = useCallback(
    (next: Environment[], activeId = activeEnvId) => {
      setEnvironments(next);
      void stores.environments.save(next);
      void stores.environments.setActiveId(activeId);
    },
    [stores.environments, activeEnvId]
  );

  const activeEnv = environments.find((e) => e.id === activeEnvId) ?? null;

  function createEnvironment(data: Omit<Environment, "id">): void {
    const newEnv: Environment = { id: crypto.randomUUID(), ...data };
    persist([...environments, newEnv]);
  }

  function updateEnvironment(id: string, patch: Partial<Omit<Environment, "id">>): void {
    persist(environments.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function deleteEnvironment(id: string): void {
    const updated = environments.filter((e) => e.id !== id);
    const next = activeEnvId === id ? (updated[0]?.id ?? "") : activeEnvId;
    setActiveEnvId(next);
    persist(updated, next);
  }

  function switchEnvironment(id: string): void {
    setActiveEnvId(id);
    void stores.environments.setActiveId(id);
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
