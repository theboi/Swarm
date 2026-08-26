import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { CoordinatorSnapshot } from "../../shared/contracts.js";
import type { CoordinatorApi } from "../api.js";

interface CoordinatorStoreValue {
  api: CoordinatorApi;
  snapshot: CoordinatorSnapshot | null;
  error: string | null;
  refresh: () => Promise<void>;
}

const CoordinatorStore = createContext<CoordinatorStoreValue | null>(null);

export function CoordinatorStoreProvider({ api, children }: { api: CoordinatorApi; children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<CoordinatorSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = async () => {
    try {
      setSnapshot(await api.getSnapshot());
      setError(null);
    } catch {
      setError("Unable to load coordinator snapshot.");
    }
  };

  useEffect(() => {
    void refresh();
  }, [api]);

  const value = useMemo(() => ({ api, snapshot, error, refresh }), [api, error, snapshot]);
  return <CoordinatorStore.Provider value={value}>{children}</CoordinatorStore.Provider>;
}

export function useCoordinatorStore(): CoordinatorStoreValue {
  const value = useContext(CoordinatorStore);
  if (!value) throw new Error("CoordinatorStoreProvider is required");
  return value;
}
