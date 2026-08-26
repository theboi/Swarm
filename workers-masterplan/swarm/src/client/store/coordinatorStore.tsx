import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { CoordinatorSnapshot } from "../../shared/contracts.js";
import type { CoordinatorApi } from "../api.js";

interface CoordinatorStoreValue {
  api: CoordinatorApi;
  snapshot: CoordinatorSnapshot | null;
  error: string | null;
  refresh: () => Promise<void>;
}

const CoordinatorStore = createContext<CoordinatorStoreValue | null>(null);

export function classifyRealtimeMessage(value: unknown, currentSequence: number): { kind: "snapshot" | "event" | "gap" | "invalid"; sequence?: number } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { kind: "invalid" };
  const message = value as { type?: unknown; sequence?: unknown };
  if (typeof message.type !== "string" || !Number.isInteger(message.sequence) || (message.sequence as number) < 0) return { kind: "invalid" };
  if (message.type === "snapshot") return { kind: "snapshot", sequence: message.sequence as number };
  if ((message.sequence as number) !== currentSequence + 1) return { kind: "gap", sequence: message.sequence as number };
  return { kind: "event", sequence: message.sequence as number };
}

function browserWebSocketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

export function CoordinatorStoreProvider({ api, children }: { api: CoordinatorApi; children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<CoordinatorSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    try {
      setSnapshot(await api.getSnapshot());
      setError(null);
    } catch {
      setError("Unable to load coordinator snapshot.");
    }
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [api]);

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | undefined;
    let retry: number | undefined;
    const connect = () => {
      if (disposed) return;
      try { socket = new WebSocket(browserWebSocketUrl()); } catch { retry = window.setTimeout(connect, 1_000); return; }
      socket.onmessage = (event) => {
        let payload: unknown;
        try { payload = JSON.parse(String(event.data)); } catch { return; }
        const outcome = classifyRealtimeMessage(payload, sequence.current);
        if (outcome.kind === "snapshot") {
          const candidate = payload as { payload?: unknown };
          if (candidate.payload && typeof candidate.payload === "object") setSnapshot(candidate.payload as CoordinatorSnapshot);
          sequence.current = outcome.sequence ?? sequence.current;
          return;
        }
        if (outcome.kind === "gap") {
          socket?.send(JSON.stringify({ type: "resync" }));
          void refresh();
          return;
        }
        if (outcome.kind === "event") {
          sequence.current = outcome.sequence ?? sequence.current;
          void refresh();
        }
      };
      socket.onclose = () => { if (!disposed) retry = window.setTimeout(connect, 1_000); };
      socket.onerror = () => socket?.close();
    };
    connect();
    return () => { disposed = true; if (retry !== undefined) window.clearTimeout(retry); socket?.close(); };
  }, [refresh]);

  const value = useMemo(() => ({ api, snapshot, error, refresh }), [api, error, refresh, snapshot]);
  return <CoordinatorStore.Provider value={value}>{children}</CoordinatorStore.Provider>;
}

export function useCoordinatorStore(): CoordinatorStoreValue {
  const value = useContext(CoordinatorStore);
  if (!value) throw new Error("CoordinatorStoreProvider is required");
  return value;
}
