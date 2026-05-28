import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { deploymentConfig } from "@/config/deployment";
import { createLocalStorageStores } from "./local-storage-stores";
import { createRemoteStores, fetchCurrentUser } from "./remote-stores";
import type { AppDataStores, StorageBackend } from "./types";

interface DataContextValue {
  stores: AppDataStores;
  backend: StorageBackend;
  user: { id: string; email: string } | null;
  authLoading: boolean;
  refreshAuth: () => Promise<void>;
  useRemote: boolean;
  setUseRemote: (value: boolean) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [backend, setBackend] = useState<StorageBackend>("local");
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(deploymentConfig.enableSaasAuth);

  const localStores = useMemo(() => createLocalStorageStores(), []);
  const remoteStores = useMemo(() => createRemoteStores(), []);

  const refreshAuth = useCallback(async () => {
    if (!deploymentConfig.enableSaasAuth || !deploymentConfig.apiBaseUrl) {
      setAuthLoading(false);
      setUser(null);
      setBackend("local");
      return;
    }

    setAuthLoading(true);
    try {
      const me = await fetchCurrentUser();
      setUser(me);
      setBackend(me ? "remote" : "local");
    } catch {
      setUser(null);
      setBackend("local");
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  const setUseRemote = useCallback((value: boolean) => {
    setBackend(value && user ? "remote" : "local");
  }, [user]);

  const stores = backend === "remote" ? remoteStores : localStores;

  const value = useMemo(
    () => ({
      stores,
      backend,
      user,
      authLoading,
      refreshAuth,
      useRemote: backend === "remote",
      setUseRemote,
    }),
    [stores, backend, user, authLoading, refreshAuth, setUseRemote]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useDataContext(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error("useDataContext must be used within DataProvider");
  }
  return ctx;
}
