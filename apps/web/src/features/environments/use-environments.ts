import { useCallback, useEffect, useRef, useState } from "react";
import { useDataContext } from "@/data/DataProvider";
import type { Environment } from "./env-types";

export function useEnvironments() {
  const { stores } = useDataContext();
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [activeEnvId, setActiveEnvId] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let list: Environment[] = [];
      let activeId = "";
      try {
        [list, activeId] = await Promise.all([stores.environments.list(), stores.environments.getActiveId()]);
      } catch {
        /* backend unreachable: start with no environments */
      }
      if (cancelled) return;
      setEnvironments(list);
      setActiveEnvId(activeId);
    })();
    return () => {
      cancelled = true;
    };
  }, [stores]);

  const environmentsRef = useRef(environments);
  environmentsRef.current = environments;
  const activeIdRef = useRef(activeEnvId);
  activeIdRef.current = activeEnvId;

  const persist = useCallback(
    (next: Environment[], activeId = activeIdRef.current) => {
      environmentsRef.current = next;
      activeIdRef.current = activeId;
      setEnvironments(next);
      setActiveEnvId(activeId);
      void stores.environments.save(next).catch(() => undefined);
      void stores.environments.setActiveId(activeId).catch(() => undefined);
    },
    [stores.environments]
  );

  const activeEnv = environments.find((e) => e.id === activeEnvId) ?? null;

  const createEnvironment = useCallback(
    (data: Omit<Environment, "id">, options: { activate?: boolean } = {}): string => {
      const newEnv: Environment = { id: crypto.randomUUID(), ...data };
      persist([...environmentsRef.current, newEnv], options.activate ? newEnv.id : activeIdRef.current);
      return newEnv.id;
    },
    [persist]
  );

  const updateEnvironment = useCallback(
    (id: string, patch: Partial<Omit<Environment, "id">>): void => {
      persist(environmentsRef.current.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    },
    [persist]
  );

  const deleteEnvironment = useCallback(
    (id: string): void => {
      const updated = environmentsRef.current.filter((e) => e.id !== id);
      const currentActive = activeIdRef.current;
      persist(updated, currentActive === id ? (updated[0]?.id ?? "") : currentActive);
    },
    [persist]
  );

  const switchEnvironment = useCallback(
    (id: string): void => {
      activeIdRef.current = id;
      setActiveEnvId(id);
      void stores.environments.setActiveId(id).catch(() => undefined);
    },
    [stores.environments]
  );

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
