import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { CoordinatorSnapshot } from "../../shared/contracts.js";
import type { CoordinatorApi } from "../api.js";
import { startUsagePolling } from "./usagePolling.js";

interface CoordinatorStoreValue {
  api: CoordinatorApi;
  snapshot: CoordinatorSnapshot | null;
  error: string | null;
  refresh: () => Promise<void>;
  refreshUsage: () => Promise<void>;
  transcriptRevision: number;
  activeTurnKeys: ReadonlySet<string>;
  activeTurnIds: ReadonlyMap<string, string>;
  limitExhaustedTurnKeys: ReadonlySet<string>;
  unreadTurnKeys: ReadonlySet<string>;
  markTurnActive: (accountId: string, threadId: string, turnId?: string) => void;
  markThreadRead: (accountId: string, threadId: string) => void;
}

const CoordinatorStore = createContext<CoordinatorStoreValue | null>(null);
const UNREAD_STORAGE_KEY = "swarm.unread-turns.v1";

function readUnreadTurns(): ReadonlySet<string> {
  try {
    const value = window.localStorage.getItem(UNREAD_STORAGE_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : []);
  } catch { return new Set(); }
}

export function classifyRealtimeMessage(value: unknown, currentSequence: number): { kind: "snapshot" | "event" | "gap" | "invalid"; sequence?: number } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { kind: "invalid" };
  const message = value as { type?: unknown; sequence?: unknown };
  if (typeof message.type !== "string" || !Number.isInteger(message.sequence) || (message.sequence as number) < 0) return { kind: "invalid" };
  if (message.type === "snapshot") return { kind: "snapshot", sequence: message.sequence as number };
  if ((message.sequence as number) !== currentSequence + 1) return { kind: "gap", sequence: message.sequence as number };
  return { kind: "event", sequence: message.sequence as number };
}

export function unreadAfterTurnEvent(current: ReadonlySet<string>, key: string, state: unknown, historical = false): ReadonlySet<string> {
  if (state !== "completed" || historical || current.has(key)) return current;
  return new Set([...current, key]);
}

export function clearUnreadTurn(current: ReadonlySet<string>, key: string): ReadonlySet<string> {
  if (!current.has(key)) return current;
  const next = new Set(current);
  next.delete(key);
  return next;
}

function browserWebSocketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

export function CoordinatorStoreProvider({ api, children }: { api: CoordinatorApi; children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<CoordinatorSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const [transcriptRevision, setTranscriptRevision] = useState(0);
  const [activeTurnKeys, setActiveTurnKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [activeTurnIds, setActiveTurnIds] = useState<ReadonlyMap<string, string>>(() => new Map());
  const [limitExhaustedTurnKeys, setLimitExhaustedTurnKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [unreadTurnKeys, setUnreadTurnKeys] = useState<ReadonlySet<string>>(readUnreadTurns);
  const markTurnActive = useCallback((accountId: string, threadId: string, turnId?: string) => {
    const key = `${accountId}\u0000${threadId}`;
    setActiveTurnKeys((current) => current.has(key) ? current : new Set([...current, key]));
    if (turnId) setActiveTurnIds((current) => current.get(key) === turnId ? current : new Map([...current, [key, turnId]]));
  }, []);
  const markThreadRead = useCallback((accountId: string, threadId: string) => {
    const key = `${accountId}\u0000${threadId}`;
    setUnreadTurnKeys((current) => clearUnreadTurn(current, key));
  }, []);
  const refresh = useCallback(async () => {
    try {
      setSnapshot(await api.getSnapshot());
      setError(null);
    } catch {
      setError("Unable to load coordinator snapshot.");
    }
  }, [api]);
  const refreshUsage = useCallback(async () => {
    try {
      const result = await api.refreshAllRateLimits();
      if ("error" in result && result.error) throw new Error(result.error.message);
      await refresh();
    } catch {
      setError("Unable to refresh account usage.");
    }
  }, [api, refresh]);

  useEffect(() => {
    void refresh();
  }, [api]);

  useEffect(() => startUsagePolling(refreshUsage), [refreshUsage]);

  useEffect(() => {
    try { window.localStorage.setItem(UNREAD_STORAGE_KEY, JSON.stringify([...unreadTurnKeys])); } catch { /* storage is optional */ }
  }, [unreadTurnKeys]);

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
          const message = payload as { type?: unknown; payload?: unknown };
          const eventPayload = message.payload && typeof message.payload === "object" && !Array.isArray(message.payload) ? message.payload as { accountId?: unknown; threadId?: unknown; turnId?: unknown; state?: unknown; historical?: unknown } : undefined;
          const accountId = typeof eventPayload?.accountId === "string" ? eventPayload.accountId : undefined;
          const threadId = typeof eventPayload?.threadId === "string" ? eventPayload.threadId : undefined;
          if (message.type === "transcript" && accountId && threadId) {
            setTranscriptRevision((revision) => revision + 1);
            return;
          }
          if (message.type === "turn" && accountId && threadId) {
            const key = `${accountId}\u0000${threadId}`;
            setUnreadTurnKeys((current) => unreadAfterTurnEvent(current, key, eventPayload?.state, eventPayload?.historical === true));
            if (eventPayload?.state === "started") {
              setActiveTurnKeys((current) => current.has(key) ? current : new Set([...current, key]));
              setLimitExhaustedTurnKeys((current) => {
                if (!current.has(key)) return current;
                const next = new Set(current);
                next.delete(key);
                return next;
              });
              if (typeof eventPayload.turnId === "string" && eventPayload.turnId) {
                const turnId = eventPayload.turnId;
                setActiveTurnIds((current) => current.get(key) === turnId ? current : new Map<string, string>([...current, [key, turnId]]));
              }
            }
            if (["completed", "failed", "interrupted", "limit_exhausted"].includes(String(eventPayload?.state))) {
              setActiveTurnKeys((current) => {
                if (!current.has(key)) return current;
                const next = new Set(current);
                next.delete(key);
                return next;
              });
              setActiveTurnIds((current) => {
                if (!current.has(key)) return current;
                const next = new Map(current);
                next.delete(key);
                return next;
              });
              if (eventPayload?.state === "limit_exhausted") setLimitExhaustedTurnKeys((current) => current.has(key) ? current : new Set([...current, key]));
            }
          }
          void refresh();
        }
      };
      socket.onclose = () => { if (!disposed) retry = window.setTimeout(connect, 1_000); };
      socket.onerror = () => socket?.close();
    };
    connect();
    return () => { disposed = true; if (retry !== undefined) window.clearTimeout(retry); socket?.close(); };
  }, [refresh]);

  const value = useMemo(() => ({ api, snapshot, error, refresh, refreshUsage, transcriptRevision, activeTurnKeys, activeTurnIds, limitExhaustedTurnKeys, unreadTurnKeys, markTurnActive, markThreadRead }), [activeTurnIds, activeTurnKeys, api, error, limitExhaustedTurnKeys, markThreadRead, markTurnActive, refresh, refreshUsage, snapshot, transcriptRevision, unreadTurnKeys]);
  return <CoordinatorStore.Provider value={value}>{children}</CoordinatorStore.Provider>;
}

export function useCoordinatorStore(): CoordinatorStoreValue {
  const value = useContext(CoordinatorStore);
  if (!value) throw new Error("CoordinatorStoreProvider is required");
  return value;
}
