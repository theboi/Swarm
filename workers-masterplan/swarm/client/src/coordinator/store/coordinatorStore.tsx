import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { CoordinatorSnapshot, PendingApproval } from "../../shared/contracts.js";
import type { CoordinatorApi } from "../api.js";
import { startUsagePolling } from "./usagePolling.js";

interface CoordinatorStoreValue {
  api: CoordinatorApi;
  snapshot: CoordinatorSnapshot | null;
  error: string | null;
  refresh: () => Promise<void>;
  refreshUsage: () => Promise<void>;
  transcriptRevisions: ReadonlyMap<string, number>;
  activeTurnKeys: ReadonlySet<string>;
  activeTurnIds: ReadonlyMap<string, string>;
  limitExhaustedTurnKeys: ReadonlySet<string>;
  unreadTurnKeys: ReadonlySet<string>;
  attentionTurnKeys: ReadonlySet<string>;
  markTurnActive: (accountId: string, threadId: string, turnId?: string) => void;
  markThreadRead: (accountId: string, threadId: string) => void;
}

const CoordinatorStore = createContext<CoordinatorStoreValue | null>(null);
const UNREAD_STORAGE_KEY = "swarm.unread-turns.v1";
const NOTIFIED_COMPLETIONS_STORAGE_KEY = "swarm.notified-completions.v1";
const ACKNOWLEDGED_APPROVALS_STORAGE_KEY = "swarm.acknowledged-approvals.v1";

function readStringSet(key: string): ReadonlySet<string> {
  try {
    const value = window.localStorage.getItem(key);
    const parsed = value ? JSON.parse(value) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : []);
  } catch { return new Set(); }
}

function readUnreadTurns(): ReadonlySet<string> { return readStringSet(UNREAD_STORAGE_KEY); }

function readStringMap(key: string): ReadonlyMap<string, string> {
  try {
    const value = window.localStorage.getItem(key);
    const parsed = value ? JSON.parse(value) : [];
    return new Map(Array.isArray(parsed) ? parsed.filter((entry): entry is [string, string] => Array.isArray(entry) && entry.length === 2 && typeof entry[0] === "string" && typeof entry[1] === "string") : []);
  } catch { return new Map(); }
}

export function classifyRealtimeMessage(value: unknown, currentSequence: number): { kind: "snapshot" | "event" | "gap" | "invalid"; sequence?: number } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { kind: "invalid" };
  const message = value as { type?: unknown; sequence?: unknown };
  if (typeof message.type !== "string" || !Number.isInteger(message.sequence) || (message.sequence as number) < 0) return { kind: "invalid" };
  if (message.type === "snapshot") return { kind: "snapshot", sequence: message.sequence as number };
  if ((message.sequence as number) !== currentSequence + 1) return { kind: "gap", sequence: message.sequence as number };
  return { kind: "event", sequence: message.sequence as number };
}

export function completionNotificationUpdate(unread: ReadonlySet<string>, notifiedCompletionIds: ReadonlyMap<string, string>, key: string, turnId: unknown, state: unknown, historical = false): { unread: ReadonlySet<string>; notifiedCompletionIds: ReadonlyMap<string, string> } {
  if (state !== "completed" || historical || typeof turnId !== "string" || !turnId || notifiedCompletionIds.get(key) === turnId) return { unread, notifiedCompletionIds };
  return {
    unread: unread.has(key) ? unread : new Set([...unread, key]),
    notifiedCompletionIds: new Map([...notifiedCompletionIds, [key, turnId]]),
  };
}

export function clearUnreadTurn(current: ReadonlySet<string>, key: string): ReadonlySet<string> {
  if (!current.has(key)) return current;
  const next = new Set(current);
  next.delete(key);
  return next;
}

export function shouldClearActiveTurn(activeTurnId: string | undefined, eventTurnId: string | undefined, historical: boolean): boolean {
  if (historical) return Boolean(activeTurnId && eventTurnId === activeTurnId);
  return activeTurnId ? eventTurnId === activeTurnId : true;
}

export function acknowledgeApprovalsForThread(current: ReadonlySet<string>, approvals: PendingApproval[], accountId: string, threadId: string): ReadonlySet<string> {
  const ids = approvals.filter((approval) => approval.accountId === accountId && approval.threadId === threadId).map((approval) => approval.id);
  if (!ids.some((id) => !current.has(id))) return current;
  return new Set([...current, ...ids]);
}

export function unreadApprovalTurnKeys(approvals: PendingApproval[], acknowledged: ReadonlySet<string>): ReadonlySet<string> {
  return new Set(approvals.filter((approval) => !acknowledged.has(approval.id)).map((approval) => `${approval.accountId}\u0000${approval.threadId}`));
}

function browserWebSocketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

export function CoordinatorStoreProvider({ api, children }: { api: CoordinatorApi; children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<CoordinatorSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const [transcriptRevisions, setTranscriptRevisions] = useState<ReadonlyMap<string, number>>(() => new Map());
  const [activeTurnKeys, setActiveTurnKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [activeTurnIds, setActiveTurnIds] = useState<ReadonlyMap<string, string>>(() => new Map());
  const activeTurnIdsRef = useRef<ReadonlyMap<string, string>>(activeTurnIds);
  activeTurnIdsRef.current = activeTurnIds;
  const [limitExhaustedTurnKeys, setLimitExhaustedTurnKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [unreadTurnKeys, setUnreadTurnKeys] = useState<ReadonlySet<string>>(readUnreadTurns);
  const notifiedCompletionIdsRef = useRef<ReadonlyMap<string, string>>(readStringMap(NOTIFIED_COMPLETIONS_STORAGE_KEY));
  const [acknowledgedApprovalIds, setAcknowledgedApprovalIds] = useState<ReadonlySet<string>>(() => readStringSet(ACKNOWLEDGED_APPROVALS_STORAGE_KEY));
  const pendingApprovalsRef = useRef<PendingApproval[]>([]);
  pendingApprovalsRef.current = snapshot?.pendingApprovals ?? [];
  const attentionTurnKeys = useMemo(() => unreadApprovalTurnKeys(snapshot?.pendingApprovals ?? [], acknowledgedApprovalIds), [acknowledgedApprovalIds, snapshot?.pendingApprovals]);
  const markTurnActive = useCallback((accountId: string, threadId: string, turnId?: string) => {
    const key = `${accountId}\u0000${threadId}`;
    setActiveTurnKeys((current) => current.has(key) ? current : new Set([...current, key]));
    if (turnId) setActiveTurnIds((current) => {
      const next = current.get(key) === turnId ? current : new Map([...current, [key, turnId]]);
      activeTurnIdsRef.current = next;
      return next;
    });
  }, []);
  const markThreadRead = useCallback((accountId: string, threadId: string) => {
    const key = `${accountId}\u0000${threadId}`;
    setUnreadTurnKeys((current) => clearUnreadTurn(current, key));
    setAcknowledgedApprovalIds((current) => acknowledgeApprovalsForThread(current, pendingApprovalsRef.current, accountId, threadId));
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
    try { window.localStorage.setItem(ACKNOWLEDGED_APPROVALS_STORAGE_KEY, JSON.stringify([...acknowledgedApprovalIds])); } catch { /* storage is optional */ }
  }, [acknowledgedApprovalIds]);

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | undefined;
    let retry: number | undefined;
    let transcriptTimer: number | undefined;
    let refreshTimer: number | undefined;
    const pendingTranscripts = new Set<string>();
    const flushTranscripts = () => {
      transcriptTimer = undefined;
      if (disposed || !pendingTranscripts.size) return;
      const keys = [...pendingTranscripts];
      pendingTranscripts.clear();
      setTranscriptRevisions((current) => {
        const next = new Map(current);
        for (const key of keys) next.set(key, (next.get(key) ?? 0) + 1);
        return next;
      });
    };
    const queueTranscript = (accountId: string, threadId: string) => {
      pendingTranscripts.add(`${accountId}\u0000${threadId}`);
      if (transcriptTimer === undefined) transcriptTimer = window.setTimeout(flushTranscripts, 250);
    };
    const queueRefresh = () => {
      if (refreshTimer !== undefined) return;
      refreshTimer = window.setTimeout(() => { refreshTimer = undefined; void refresh(); }, 250);
    };
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
            queueTranscript(accountId, threadId);
            return;
          }
          if (message.type === "turn" && accountId && threadId) {
            queueTranscript(accountId, threadId);
            const key = `${accountId}\u0000${threadId}`;
            setUnreadTurnKeys((current) => {
              const update = completionNotificationUpdate(current, notifiedCompletionIdsRef.current, key, eventPayload?.turnId, eventPayload?.state, eventPayload?.historical === true);
              if (update.notifiedCompletionIds !== notifiedCompletionIdsRef.current) {
                notifiedCompletionIdsRef.current = update.notifiedCompletionIds;
                try { window.localStorage.setItem(NOTIFIED_COMPLETIONS_STORAGE_KEY, JSON.stringify([...update.notifiedCompletionIds])); } catch { /* storage is optional */ }
              }
              return update.unread;
            });
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
                setActiveTurnIds((current) => {
                  const next = current.get(key) === turnId ? current : new Map<string, string>([...current, [key, turnId]]);
                  activeTurnIdsRef.current = next;
                  return next;
                });
              }
            }
            if (["completed", "failed", "interrupted", "limit_exhausted"].includes(String(eventPayload?.state))) {
              const eventTurnId = typeof eventPayload?.turnId === "string" ? eventPayload.turnId : undefined;
              if (!shouldClearActiveTurn(activeTurnIdsRef.current.get(key), eventTurnId, eventPayload?.historical === true)) return;
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
                activeTurnIdsRef.current = next;
                return next;
              });
              if (eventPayload?.state === "limit_exhausted") setLimitExhaustedTurnKeys((current) => current.has(key) ? current : new Set([...current, key]));
            }
          }
          queueRefresh();
        }
      };
      socket.onclose = () => { if (!disposed) retry = window.setTimeout(connect, 1_000); };
      socket.onerror = () => socket?.close();
    };
    connect();
    return () => { disposed = true; if (retry !== undefined) window.clearTimeout(retry); socket?.close(); if (transcriptTimer !== undefined) window.clearTimeout(transcriptTimer); if (refreshTimer !== undefined) window.clearTimeout(refreshTimer); };
  }, [refresh]);

  const value = useMemo(() => ({ api, snapshot, error, refresh, refreshUsage, transcriptRevisions, activeTurnKeys, activeTurnIds, limitExhaustedTurnKeys, unreadTurnKeys, attentionTurnKeys, markTurnActive, markThreadRead }), [activeTurnIds, activeTurnKeys, api, attentionTurnKeys, error, limitExhaustedTurnKeys, markThreadRead, markTurnActive, refresh, refreshUsage, snapshot, transcriptRevisions, unreadTurnKeys]);
  return <CoordinatorStore.Provider value={value}>{children}</CoordinatorStore.Provider>;
}

export function useCoordinatorStore(): CoordinatorStoreValue {
  const value = useContext(CoordinatorStore);
  if (!value) throw new Error("CoordinatorStoreProvider is required");
  return value;
}
