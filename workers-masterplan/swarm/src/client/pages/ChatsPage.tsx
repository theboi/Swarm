import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Archive, CircleStop, CornerUpRight, MessageSquarePlus, Network, Plus, Send, SquareTerminal } from "lucide-react";

import type { AccountId, ApiResult, ChatExecutionSettings, ChatModelOption, CoordinatorSnapshot, ThreadSummary, TranscriptItem } from "../../shared/contracts.js";
import type { CoordinatorApi, MarkdownDocument } from "../api.js";
import type { ChatTarget } from "./HomePage.js";
import { MarkdownViewer } from "../components/MarkdownViewer.js";
import { OverlayCloseButton } from "../components/OverlayCloseButton.js";
import { TranscriptItemView } from "../components/TranscriptItemView.js";
import { AccountUsageBar } from "../components/AccountSummaryPanel.js";
import { TurnOptions } from "../components/TurnOptions.js";
import { Toast } from "../components/Toast.js";
import { chatExecutionSettingsKey, defaultExecutionSettings, normalizeExecutionSettings, readChatExecutionSettings, readGlobalExecutionSettings, writeChatExecutionSettings, writeGlobalExecutionSettings } from "../turnSettings.js";

type ChatsApi = Pick<CoordinatorApi, "readTranscript" | "readMarkdown" | "listModels" | "listThreads" | "startTurn" | "startThread" | "archiveThread" | "steerTurn" | "interruptTurn" | "decideApproval"> & Partial<Pick<CoordinatorApi, "moveThreadToAccount">>;

interface SubagentReference {
  threadId: string;
  label: string;
}

function textField(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function subagentReferences(items: TranscriptItem[], parentThreadId?: string | null): SubagentReference[] {
  const references = new Map<string, SubagentReference>();
  const add = (threadId: unknown, label?: unknown) => {
    const id = textField(threadId);
    if (!id || id === parentThreadId || references.has(id)) return;
    references.set(id, { threadId: id, label: textField(label) ?? `Subagent ${references.size + 1}` });
  };

  for (const item of items) {
    if (item.type === "subAgentActivity") add(item.payload.agentThreadId, item.payload.agentPath);
    if (item.type !== "collabAgentToolCall") continue;
    const states = item.payload.agentsStates && typeof item.payload.agentsStates === "object" && !Array.isArray(item.payload.agentsStates)
      ? item.payload.agentsStates as Record<string, unknown>
      : {};
    const receivers = Array.isArray(item.payload.receiverThreadIds) ? item.payload.receiverThreadIds : [];
    for (const receiver of receivers) {
      const state = typeof receiver === "string" && states[receiver] && typeof states[receiver] === "object" && !Array.isArray(states[receiver])
        ? states[receiver] as Record<string, unknown>
        : {};
      add(receiver, state.agentPath ?? state.path ?? state.name);
    }
  }
  return [...references.values()];
}

function settingsKey(accountId: AccountId | null, threadId: string | null, isDraftChat: boolean): string | null {
  return accountId && threadId && !isDraftChat ? chatExecutionSettingsKey(accountId, threadId) : null;
}

export { normalizeExecutionSettings } from "../turnSettings.js";

function initialAccount(snapshot: CoordinatorSnapshot, initialThreadId?: string | null, initialAccountId?: AccountId): AccountId | null {
  return snapshot.threads.find((thread) => thread.id === initialThreadId)?.accountId
    ?? snapshot.accounts.find((account) => account.id === initialAccountId)?.id
    ?? snapshot.accounts[0]?.id
    ?? null;
}

function threadsFor(snapshot: CoordinatorSnapshot, accountId: AccountId | null): ThreadSummary[] {
  return accountId ? snapshot.threads.filter((thread) => thread.accountId === accountId && !thread.archived) : [];
}

function useCompactPicker(): boolean {
  const [compact, setCompact] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const update = () => setCompact(window.innerWidth <= 768);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return compact;
}

function isPermissionGrant(decision: string): boolean {
  return decision === "grant_turn" || decision === "grant_turn_strict";
}

function approvalLabel(decision: string): string {
  switch (decision) {
    case "grant_turn": return "Grant requested turn permissions";
    case "grant_turn_strict": return "Grant requested turn permissions strictly";
    case "accept": return "Accept approval";
    case "decline": return "Decline approval";
    case "cancel": return "Cancel approval";
    case "deny": return "Deny approval";
    default: return `${decision} approval`;
  }
}

function limitCountdown(resetAt: number | null, now: number): string | null {
  if (!resetAt) return null;
  const seconds = Math.max(0, resetAt - Math.floor(now / 1_000));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (hours) return `${hours}h ${minutes}m`;
  return `${Math.max(1, minutes)}m`;
}

function turnIdFromStart(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const turn = (value as Record<string, unknown>).turn;
  return turn && typeof turn === "object" && !Array.isArray(turn) && typeof (turn as Record<string, unknown>).id === "string"
    ? (turn as Record<string, string>).id
    : undefined;
}

function SubagentChatDialog({ accountId, reference, api, models, settings, activeTurnKeys, activeTurnIds, markTurnActive, onSettingsChange, onOpenMarkdown, onClose, report, reportError }: {
  accountId: AccountId;
  reference: SubagentReference;
  api: ChatsApi;
  models: ChatModelOption[];
  settings: ChatExecutionSettings;
  activeTurnKeys: ReadonlySet<string>;
  activeTurnIds: ReadonlyMap<string, string>;
  markTurnActive: (accountId: string, threadId: string, turnId?: string) => void;
  onSettingsChange: (settings: ChatExecutionSettings) => void;
  onOpenMarkdown: (path: string) => void;
  onClose: () => void;
  report: (message: string) => void;
  reportError: (message: string) => void;
}) {
  const [items, setItems] = useState<TranscriptItem[]>([]);
  const [draft, setDraft] = useState("");
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const opened = useRef(false);
  const key = `${accountId}\u0000${reference.threadId}`;
  const thinking = activeTurnKeys.has(key);
  const latestTurnId = activeTurnIds.get(key) ?? [...items].reverse().find((item) => item.turnId)?.turnId ?? undefined;

  useEffect(() => {
    let live = true;
    void api.readTranscript(accountId, reference.threadId).then((result) => {
      if (!live) return;
      setLoading(false);
      if ("error" in result && result.error) return reportError(result.error.message);
      setItems(result.data);
    }).catch(() => {
      if (!live) return;
      setLoading(false);
      reportError("Unable to load this subagent.");
    });
    return () => { live = false; };
  }, [accountId, api, reference.threadId, reportError, revision]);

  useLayoutEffect(() => {
    if (loading || opened.current || !scrollRef.current) return;
    opened.current = true;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [items, loading]);

  useEffect(() => {
    const priorFocus = globalThis.document.activeElement as HTMLElement | null;
    window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => priorFocus?.focus();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (globalThis.document.visibilityState === "visible") setRevision((current) => current + 1);
    }, 2_500);
    return () => window.clearInterval(timer);
  }, []);

  const send = async () => {
    const text = draft.trim();
    if (!text || thinking) return;
    try {
      const result = await api.startTurn(accountId, reference.threadId, text, normalizeExecutionSettings(models, settings));
      if ("error" in result && result.error) return reportError(result.error.message);
      markTurnActive(accountId, reference.threadId, turnIdFromStart(result.data));
      setDraft("");
      setRevision((current) => current + 1);
      report("Message sent.");
    } catch { reportError("Unable to message this subagent."); }
  };

  const steer = async () => {
    const text = draft.trim();
    if (!latestTurnId || !text) return;
    try {
      const result = await api.steerTurn(accountId, reference.threadId, latestTurnId, text);
      if ("error" in result && result.error) return reportError(result.error.message);
      setDraft("");
      setRevision((current) => current + 1);
      report("Turn steered.");
    } catch { reportError("Unable to steer this subagent."); }
  };

  const interrupt = async () => {
    if (!latestTurnId) return;
    try {
      const result = await api.interruptTurn(accountId, reference.threadId, latestTurnId);
      if ("error" in result && result.error) return reportError(result.error.message);
      setRevision((current) => current + 1);
      report("Turn interrupted.");
    } catch { reportError("Unable to interrupt this subagent."); }
  };

  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="subagent-dialog" role="dialog" aria-modal="true" aria-labelledby="subagent-dialog-title" onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}>
      <header className="subagent-dialog__header"><div><span>{accountId}</span><h2 id="subagent-dialog-title">Subagent {reference.label}</h2></div>{thinking ? <span className="chat-thinking"><span className="loading-spinner" aria-hidden="true" />Thinking</span> : null}<OverlayCloseButton ref={closeRef} onClick={onClose} /></header>
      <div className="transcript-scroll subagent-dialog__transcript" ref={scrollRef} aria-label={`Conversation with ${reference.label}`}>
        {loading ? <div className="transcript-working"><span className="loading-spinner" aria-hidden="true" /><span>Loading subagent…</span></div> : items.length ? items.map((item) => <TranscriptItemView item={item} key={item.id} active={thinking && item.turnId === latestTurnId && item.type === "reasoning"} onOpenMarkdown={onOpenMarkdown} />) : <div className="transcript-empty"><p>No messages in this subagent yet.</p></div>}
      </div>
      <form className="chat-compose subagent-dialog__composer" onSubmit={(event) => { event.preventDefault(); void send(); }}>
        <div className="chat-compose__field"><textarea aria-label="Message" rows={2} placeholder={thinking ? "Steer this turn…" : "Write a message…"} value={draft} onChange={(event) => setDraft(event.target.value)} /></div>
        <TurnOptions models={models} settings={settings} onChange={onSettingsChange} />
        <div className="chat-compose__footer"><div className="chat-compose__turn-actions"><button type="button" aria-label="Steer" title="Steer" disabled={!latestTurnId || !draft.trim()} onClick={() => void steer()}><CornerUpRight aria-hidden="true" size={16} strokeWidth={1.75} /></button><button type="button" aria-label="Interrupt" title="Interrupt" disabled={!latestTurnId || !thinking} onClick={() => void interrupt()}><CircleStop aria-hidden="true" size={16} strokeWidth={1.75} /></button></div><button className="primary-button chat-compose__send" type="submit" aria-label="Send" title="Send" disabled={thinking || !draft.trim()}><Send aria-hidden="true" size={16} strokeWidth={2} /></button></div>
      </form>
    </section>
  </div>;
}

export function ChatsPage({ snapshot, api, initialThreadId, initialTarget, initialAccountId, transcriptRevision: liveTranscriptRevision = 0, activeTurnKeys = new Set<string>(), activeTurnIds = new Map<string, string>(), markTurnActive = () => undefined, onRefresh = async () => undefined }: { snapshot: CoordinatorSnapshot; api: ChatsApi; initialThreadId?: string | null; initialTarget?: ChatTarget; initialAccountId?: AccountId; transcriptRevision?: number; activeTurnKeys?: ReadonlySet<string>; activeTurnIds?: ReadonlyMap<string, string>; limitExhaustedTurnKeys?: ReadonlySet<string>; markTurnActive?: (accountId: string, threadId: string, turnId?: string) => void; onRefresh?: () => Promise<void> }) {
  const requestedInitialThreadId = initialTarget?.threadId ?? initialThreadId;
  const requestedInitialAccountId = initialTarget?.accountId ?? initialAccountId;
  const [accountId, setAccountId] = useState<AccountId | null>(() => requestedInitialAccountId ?? initialAccount(snapshot, requestedInitialThreadId, initialAccountId));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(() => requestedInitialThreadId ?? threadsFor(snapshot, requestedInitialAccountId ?? initialAccount(snapshot, requestedInitialThreadId, initialAccountId))[0]?.id ?? null);
  const [isDraftChat, setIsDraftChat] = useState(false);
  const [createdThread, setCreatedThread] = useState<ThreadSummary | null>(null);
  const [threadsByAccount, setThreadsByAccount] = useState<Partial<Record<AccountId, ThreadSummary[]>>>(() => Object.fromEntries(snapshot.accounts.map((account) => [account.id, threadsFor(snapshot, account.id)])));
  const [loadingAccountId, setLoadingAccountId] = useState<AccountId | null>(null);
  const [pendingTarget, setPendingTarget] = useState<ChatTarget | null>(initialTarget ?? null);
  const [items, setItems] = useState<TranscriptItem[]>([]);
  const [transcriptRevision, setTranscriptRevision] = useState(0);
  const [scrollRequest, setScrollRequest] = useState(0);
  const [draft, setDraft] = useState("");
  const [models, setModels] = useState<ChatModelOption[]>([]);
  const [executionSettings, setExecutionSettings] = useState<ChatExecutionSettings>({ permissionMode: "ask_for_approval" });
  const [settingsByChat, setSettingsByChat] = useState<Record<string, ChatExecutionSettings>>(readChatExecutionSettings);
  const [globalSettings, setGlobalSettings] = useState<ChatExecutionSettings>(readGlobalExecutionSettings);
  const [document, setDocument] = useState<MarkdownDocument | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<AccountId | null>(null);
  const [moving, setMoving] = useState(false);
  const [openSubagent, setOpenSubagent] = useState<SubagentReference | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const lastOpenedChatKey = useRef<string | null>(null);
  const scrollPosition = useRef(0);
  const moveDialogRef = useRef<HTMLElement>(null);
  const moveCloseButton = useRef<HTMLButtonElement>(null);
  const compact = useCompactPicker();
  const threads = useMemo(() => {
    const listed = accountId ? threadsByAccount[accountId] ?? [] : [];
    return createdThread && createdThread.accountId === accountId && !listed.some((thread) => thread.id === createdThread.id) ? [...listed, createdThread] : listed;
  }, [threadsByAccount, accountId, createdThread]);
  const selectedThread = threads.find((thread) => thread.id === threadId && thread.accountId === accountId)
    ?? (createdThread?.id === threadId && createdThread.accountId === accountId ? createdThread : null);
  const selectedAccount = snapshot.accounts.find((account) => account.id === accountId) ?? null;
  const terminalCommand = selectedAccount?.terminalCommand;
  const approvals = snapshot.pendingApprovals.filter((approval) => approval.accountId === accountId && approval.threadId === threadId);
  const currentSettingsKey = settingsKey(accountId, threadId, isDraftChat);

  useEffect(() => {
    if (!initialTarget) return;
    setPendingTarget(initialTarget);
    setAccountId(initialTarget.accountId);
    setThreadId(initialTarget.threadId);
    setIsDraftChat(false);
  }, [initialTarget?.accountId, initialTarget?.threadId]);

  useEffect(() => {
    if (initialTarget || !initialAccountId) return;
    setPendingTarget(null);
    setAccountId(initialAccountId);
    setThreadId(null);
    setIsDraftChat(false);
  }, [initialAccountId, initialTarget?.accountId, initialTarget?.threadId]);

  useEffect(() => {
    if (isDraftChat) return;
    if (pendingTarget) {
      if (threads.some((thread) => thread.accountId === pendingTarget.accountId && thread.id === pendingTarget.threadId)) setPendingTarget(null);
      return;
    }
    setThreadId((currentThreadId) => currentThreadId && threads.some((thread) => thread.id === currentThreadId) ? currentThreadId : threads[0]?.id ?? null);
  }, [isDraftChat, pendingTarget, threads]);

  useEffect(() => {
    if (!accountId || !threadId || isDraftChat) { setItems([]); return; }
    const openedKey = `${accountId}\u0000${threadId}`;
    const shouldScrollToBottom = lastOpenedChatKey.current !== openedKey;
    if (shouldScrollToBottom) lastOpenedChatKey.current = openedKey;
    let live = true;
    void api.readTranscript(accountId, threadId).then((result) => {
      if (!live) return;
      if ("error" in result && result.error) { setError(result.error.message); setItems([]); return; }
      setItems(result.data);
      if (shouldScrollToBottom) setScrollRequest((request) => request + 1);
    }).catch(() => {
      if (!live) return;
      setError("Unable to load this chat.");
      setItems([]);
    });
    return () => { live = false; };
  }, [api, accountId, threadId, isDraftChat, transcriptRevision, liveTranscriptRevision]);

  useLayoutEffect(() => {
    if (!scrollRequest || !scrollRef.current) return;
    const scroll = () => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; };
    scroll();
    const timer = window.setTimeout(scroll, 0);
    return () => window.clearTimeout(timer);
  }, [scrollRequest]);

  useEffect(() => {
    if (!accountId || (!threadId && !isDraftChat)) return;
    const timer = window.setTimeout(() => composerRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [accountId, threadId, isDraftChat]);

  useEffect(() => {
    if (!accountId) { setModels([]); return; }
    let live = true;
    setModels([]);
    void api.listModels(accountId).then((result) => {
      if (!live || ("error" in result && result.error)) return;
      setModels(result.data);
    }).catch(() => undefined);
    return () => { live = false; };
  }, [accountId, api]);

  useEffect(() => {
    const fallback = models.length ? normalizeExecutionSettings(models, globalSettings) : defaultExecutionSettings(models);
    if (!currentSettingsKey) { setExecutionSettings(fallback); return; }
    setExecutionSettings(settingsByChat[currentSettingsKey] ?? fallback);
  }, [currentSettingsKey, globalSettings, models, settingsByChat]);

  useEffect(() => {
    writeChatExecutionSettings(settingsByChat);
  }, [settingsByChat]);

  useEffect(() => writeGlobalExecutionSettings(globalSettings), [globalSettings]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 4_500);
    return () => window.clearTimeout(timer);
  }, [message]);

  const updateExecutionSettings = (next: ChatExecutionSettings) => {
    setExecutionSettings(next);
    setGlobalSettings(next);
    if (currentSettingsKey) setSettingsByChat((current) => ({ ...current, [currentSettingsKey]: next }));
  };

  const chooseAccount = (nextAccountId: AccountId) => {
    if (nextAccountId === accountId) { setPickerOpen((open) => !open); return; }
    setAccountId(nextAccountId);
    setIsDraftChat(false);
    setPickerOpen(false);
  };

  const chooseThread = (nextThreadId: string) => { setThreadId(nextThreadId); setIsDraftChat(false); setPickerOpen(false); };
  const beginDraftChat = () => {
    if (!accountId) return;
    setThreadId(null);
    lastOpenedChatKey.current = null;
    setCreatedThread(null);
    setItems([]);
    setDraft("");
    setIsDraftChat(true);
    setPickerOpen(false);
    setMessage(null);
    setError(null);
  };
  const report = useCallback((text: string) => { setError(null); setMessage(text); }, []);
  const reportError = useCallback((text: string) => { setMessage(null); setError(text); }, []);

  useEffect(() => {
    if (!accountId) return;
    let live = true;
    setLoadingAccountId(accountId);
    void api.listThreads(accountId).then((result) => {
      if (!live) return;
      setLoadingAccountId(null);
      if ("error" in result && result.error) return reportError(result.error.message);
      setThreadsByAccount((current) => ({ ...current, [accountId]: result.data.filter((thread) => !thread.archived) }));
    }).catch(() => {
      if (!live) return;
      setLoadingAccountId(null);
      reportError("Unable to load chats for this account.");
    });
    return () => { live = false; };
  }, [accountId, api, reportError]);
  const run = async <T,>(operation: () => Promise<ApiResult<T>>, success: string, onSuccess?: (data: T) => void) => {
    try {
      const result = await operation();
      if ("error" in result && result.error) return reportError(result.error.message);
      onSuccess?.(result.data);
      await onRefresh();
      setTranscriptRevision((revision) => revision + 1);
      report(success);
    } catch {
      reportError("Unable to update this chat.");
    }
  };

  const openMarkdown = async (path: string) => {
    if (!accountId) return;
    scrollPosition.current = scrollRef.current?.scrollTop ?? 0;
    try {
      const result = await api.readMarkdown(accountId, path);
      if ("error" in result && result.error) return reportError(result.error.message);
      setDocument(result.data);
    } catch {
      reportError("Unable to open this Markdown file.");
    }
  };

  const closeMarkdown = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollPosition.current;
    setDocument(null);
  };

  const copyTerminalCommand = async () => {
    try {
      if (!terminalCommand || !navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(terminalCommand);
      report("Open-terminal command copied.");
    } catch {
      reportError("Unable to copy the open-terminal command.");
    }
  };

  const sendMessage = async () => {
    const text = draft.trim();
    if (!accountId || !text || isWorking || (!isDraftChat && !selectedThread)) return;
    const turnSettings = normalizeExecutionSettings(models, executionSettings);
    try {
      if (isDraftChat) {
        const created = await api.startThread(accountId);
        if ("error" in created && created.error) return reportError(created.error.message);
        const started = await api.startTurn(accountId, created.data.id, text, turnSettings);
        if ("error" in started && started.error) return reportError(started.error.message);
        markTurnActive(accountId, created.data.id, turnIdFromStart(started.data));
        setSettingsByChat((current) => ({ ...current, [chatExecutionSettingsKey(accountId, created.data.id)]: turnSettings }));
        setGlobalSettings(turnSettings);
        setCreatedThread(created.data);
        setThreadId(created.data.id);
        setIsDraftChat(false);
        setDraft("");
        await onRefresh();
        setTranscriptRevision((revision) => revision + 1);
        report("Message sent.");
        return;
      }
      await run(() => api.startTurn(accountId, selectedThread!.id, text, turnSettings), "Message sent.", (result) => {
        markTurnActive(accountId, selectedThread!.id, turnIdFromStart(result));
        setDraft("");
      });
    } catch {
      reportError("Unable to start this chat. Check that this account is connected, then try again.");
    }
  };

  const activeTurnKey = accountId && threadId ? `${accountId}\u0000${threadId}` : "";
  const latestTurnId = (activeTurnKey ? activeTurnIds.get(activeTurnKey) : undefined) ?? [...items].reverse().find((item) => item.turnId)?.turnId;
  const isThinking = Boolean(activeTurnKey && (activeTurnKeys.has(activeTurnKey) || selectedThread?.activity === "active"));
  const isWorking = isThinking;
  const canSteer = Boolean(selectedThread && accountId && latestTurnId && (isThinking || selectedThread.capabilities.canSteer));
  const canInterrupt = Boolean(selectedThread && accountId && latestTurnId && (isThinking || selectedThread.capabilities.canInterrupt));
  const selectedChatName = isDraftChat ? "New chat" : selectedThread?.name ?? "No chat selected";
  const canSend = Boolean(accountId && (isDraftChat || selectedThread) && !isWorking);
  const exhaustedLimit = selectedAccount?.rateLimits.filter((limit) => limit.usedPercent !== null && limit.usedPercent >= 100).sort((left, right) => (left.resetsAt ?? Number.MAX_SAFE_INTEGER) - (right.resetsAt ?? Number.MAX_SAFE_INTEGER))[0];
  const waitingAssignment = selectedThread && accountId ? snapshot.workerAssignments?.find((assignment) => assignment.accountId === accountId && assignment.threadId === selectedThread.id && assignment.state === "waiting_for_limit") : undefined;
  const limitExhausted = Boolean(selectedThread && activeTurnKey && waitingAssignment);
  const continuationAccounts = snapshot.accounts.filter((account) => account.id !== accountId && account.connection === "connected" && account.authentication === "authenticated");
  const liveReasoningId = isThinking && latestTurnId ? [...items].reverse().find((item) => item.turnId === latestTurnId && item.type === "reasoning" && Array.isArray(item.payload.summary) && item.payload.summary.some((part) => typeof part === "string" && part.trim()))?.id : undefined;
  const subagents = useMemo(() => subagentReferences(items, threadId), [items, threadId]);
  const openSubagentSettings = openSubagent && accountId
    ? settingsByChat[chatExecutionSettingsKey(accountId, openSubagent.threadId)] ?? (models.length ? normalizeExecutionSettings(models, globalSettings) : defaultExecutionSettings(models))
    : null;

  const updateSubagentSettings = (next: ChatExecutionSettings) => {
    if (!openSubagent || !accountId) return;
    setSettingsByChat((current) => ({ ...current, [chatExecutionSettingsKey(accountId, openSubagent.threadId)]: next }));
    setGlobalSettings(next);
  };

  useEffect(() => {
    if (!accountId || !threadId || isDraftChat || !isThinking) return;
    const timer = window.setInterval(() => {
      if (globalThis.document.visibilityState === "visible") setTranscriptRevision((revision) => revision + 1);
    }, 2_500);
    return () => window.clearInterval(timer);
  }, [accountId, isDraftChat, isThinking, threadId]);

  useEffect(() => {
    if (!limitExhausted) return;
    setClock(Date.now());
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [limitExhausted]);

  useEffect(() => {
    if (!moveOpen) return;
    const priorFocus = globalThis.document.activeElement as HTMLElement | null;
    window.setTimeout(() => moveCloseButton.current?.focus(), 0);
    return () => priorFocus?.focus();
  }, [moveOpen]);

  const openMove = () => {
    const first = continuationAccounts[0]?.id ?? null;
    setMoveTarget(first);
    setMoveOpen(true);
  };

  const moveToAccount = async () => {
    if (!accountId || !selectedThread || !moveTarget || !api.moveThreadToAccount) return;
    setMoving(true);
    try {
      const result = await api.moveThreadToAccount(accountId, selectedThread.id, moveTarget);
      if ("error" in result && result.error) return reportError(result.error.message);
      setCreatedThread(result.data);
      setAccountId(moveTarget);
      setThreadId(result.data.id);
      setIsDraftChat(false);
      setMoveOpen(false);
      await onRefresh();
      setTranscriptRevision((revision) => revision + 1);
      report(`Continuation started on ${moveTarget}.`);
    } catch {
      reportError("Unable to move this chat. The original chat was kept in place.");
    } finally {
      setMoving(false);
    }
  };
  return (
    <section className="chats-page" aria-label="Chats">
      {message ? <Toast onDismiss={() => setMessage(null)}>{message}</Toast> : null}
      {error ? <Toast tone="error" onDismiss={() => setError(null)}>{error}</Toast> : null}
      <div className="chats-workspace">
        <nav className={`chat-account-picker ${compact ? "chat-account-picker--pills" : ""}`} aria-label="Accounts">
          <div className="chat-account-picker__heading"><span>Accounts</span><span>{snapshot.accounts.length}</span></div>
          {snapshot.accounts.map((account) => {
            const accountThreads = threadsByAccount[account.id] ?? threadsFor(snapshot, account.id);
            const threadCount = accountThreads.length;
            const accountThinking = accountThreads.some((thread) => thread.activity === "active" || activeTurnKeys.has(`${thread.accountId}\u0000${thread.id}`));
            const accountNeedsAttention = snapshot.pendingApprovals.some((approval) => approval.accountId === account.id);
            return <button key={account.id} type="button" aria-label={account.id} aria-pressed={account.id === accountId} onClick={() => chooseAccount(account.id)}><span className={accountThinking ? "chat-account-picker__activity" : ""} aria-label={accountThinking ? `${account.id} working` : undefined}><span className={`chat-account-picker__status chat-account-picker__status--${account.connection}`} aria-hidden="true" /></span><span>{account.id}</span><span className="chat-account-picker__count"><span aria-hidden="true">{threadCount}</span>{accountNeedsAttention ? <span className="notification-dot chat-row-notification" role="img" aria-label={`${account.id} needs attention`} /> : null}</span></button>;
          })}
        </nav>
        {!compact || pickerOpen ? <aside className="thread-picker" aria-label={`Chats for ${accountId ?? "selected account"}`}>
          <button className="thread-picker__new" type="button" disabled={!accountId} onClick={beginDraftChat}><Plus aria-hidden="true" size={16} strokeWidth={2} /><span>New chat</span></button>
          <div className="thread-picker__heading"><span>Chats</span><span>{threads.length}</span></div>
          <div className="thread-picker__list">{loadingAccountId === accountId && threads.length === 0 ? <div className="thread-picker__loading" role="status" aria-label="Loading chats"><span className="loading-spinner" aria-hidden="true" /><span>Loading chats…</span></div> : threads.length ? threads.map((thread) => {
            const name = thread.name ?? "Unnamed chat";
            const thinking = activeTurnKeys.has(`${thread.accountId}\u0000${thread.id}`) || thread.activity === "active";
            const needsAttention = snapshot.pendingApprovals.some((approval) => approval.accountId === thread.accountId && approval.threadId === thread.id);
            const status = thinking ? "Thinking" : thread.capabilities.canSteer ? "Working" : "Ready for messages";
            return <button key={thread.id} type="button" aria-label={name} aria-pressed={thread.id === threadId} onClick={() => chooseThread(thread.id)}><span className="thread-picker__icon">{thinking ? <span className="loading-spinner" role="img" aria-label={`${name} working`} /> : <MessageSquarePlus aria-hidden="true" size={16} strokeWidth={1.75} />}</span><span className="thread-picker__copy"><strong>{name}</strong><small>{status}</small></span>{needsAttention ? <span className="notification-dot chat-row-notification" role="img" aria-label={`${name} needs attention`} /> : null}</button>;
          }) : <p className="thread-picker__empty">No chats for this account.</p>}</div>
          {selectedAccount ? <footer className="thread-picker__usage"><AccountUsageBar account={selectedAccount} showLabels /></footer> : null}
        </aside> : null}
        <section className="chat-panel" aria-labelledby="selected-chat-title">
          <header className="chat-panel__header">
            <div className="chat-panel__title"><span className="chat-panel__account">{accountId ?? "No account"}</span><h2 id="selected-chat-title">{selectedChatName}</h2>{isThinking ? <span className="chat-thinking" aria-label="Codex is thinking"><span className="loading-spinner" aria-hidden="true" />Thinking</span> : null}</div>
            <div className="chat-panel__tools"><button className="chat-tool chat-tool--icon" type="button" aria-label="Archive chat" title="Archive chat" disabled={!selectedThread || !accountId || isDraftChat} onClick={() => selectedThread && accountId && void run(() => api.archiveThread(accountId, selectedThread.id), "Chat archived.", () => { setThreadsByAccount((current) => ({ ...current, [accountId]: (current[accountId] ?? []).filter((thread) => thread.id !== selectedThread.id) })); if (createdThread?.id === selectedThread.id) setCreatedThread(null); })}><Archive aria-hidden="true" size={17} strokeWidth={1.75} /></button>{terminalCommand ? <button className="chat-tool chat-tool--icon" type="button" aria-label="Copy open-terminal command" title="Copy open-terminal command" onClick={() => void copyTerminalCommand()}><SquareTerminal aria-hidden="true" size={17} strokeWidth={1.75} /></button> : null}</div>
          </header>
          {approvals.length ? <div className="chat-approvals">{approvals.map((approval) => <section className="chat-approval" key={approval.id} aria-labelledby={`approval-${approval.id}`}><div className="chat-approval__copy"><h3 id={`approval-${approval.id}`}>Approval required</h3><p>{approval.summary}</p></div><div className="chat-approval__actions">{approval.availableDecisions.map((decision) => {
            const permissions = isPermissionGrant(decision) ? approval.requestedPermissions : undefined;
            const missingPermissions = isPermissionGrant(decision) && (!permissions || Object.keys(permissions).length === 0);
            return <button key={decision} type="button" disabled={missingPermissions} onClick={() => void run(() => api.decideApproval(approval, decision, permissions), "Approval response sent.")}>{approvalLabel(decision)}</button>;
          })}</div></section>)}</div> : null}
          {subagents.length ? <nav className="subagent-pills" aria-label="Subagents">{subagents.map((subagent) => <button className="subagent-pill" key={subagent.threadId} type="button" aria-label={`Open subagent ${subagent.label}`} onClick={() => setOpenSubagent(subagent)}><Network aria-hidden="true" size={14} strokeWidth={1.75} /><span>{subagent.label}</span>{activeTurnKeys.has(`${accountId}\u0000${subagent.threadId}`) ? <span className="loading-spinner" aria-label={`${subagent.label} working`} role="img" /> : null}</button>)}</nav> : null}
          <div className="transcript-scroll" data-testid="transcript-scroll" ref={scrollRef} aria-label="Conversation">{items.length ? items.map((item) => <TranscriptItemView active={item.id === liveReasoningId} item={item} key={item.id} onOpenMarkdown={(path) => void openMarkdown(path)} />) : <div className="transcript-empty"><MessageSquarePlus aria-hidden="true" size={20} strokeWidth={1.5} /><p>{isDraftChat ? "Your chat will be created when you send the first message." : selectedThread ? "No messages in this chat yet." : "Choose a chat to view its messages."}</p></div>}{isThinking && !liveReasoningId ? <div className="transcript-working" aria-label="Codex is working"><span className="loading-spinner" aria-hidden="true" /><span>Thinking… Live updates will appear here.</span></div> : null}</div>
          <form className="chat-compose" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
            <div className="chat-compose__field"><textarea ref={composerRef} id="message" aria-label="Message" rows={2} disabled={!accountId || (!isDraftChat && !selectedThread)} placeholder={isWorking ? "Steer this turn…" : "Write a message…"} value={draft} onChange={(event) => setDraft(event.target.value)} /></div>
            <TurnOptions models={models} settings={executionSettings} onChange={updateExecutionSettings} />
            {limitExhausted ? <section className="chat-limit-notice" aria-label="Session limit reached" role="status"><p>Waiting for limit to reset{limitCountdown(exhaustedLimit?.resetsAt ?? null, clock) ? ` in ${limitCountdown(exhaustedLimit?.resetsAt ?? null, clock)}` : ""} before resuming.</p><button type="button" onClick={openMove}>Move to another account</button></section> : null}
            <div className="chat-compose__footer"><div className="chat-compose__turn-actions"><button type="button" aria-label="Steer" title="Steer" disabled={!canSteer} onClick={() => selectedThread && accountId && latestTurnId && void run(() => api.steerTurn(accountId, selectedThread.id, latestTurnId, draft), "Turn steered.")}><CornerUpRight aria-hidden="true" size={16} strokeWidth={1.75} /></button><button type="button" aria-label="Interrupt" title="Interrupt" disabled={!canInterrupt} onClick={() => selectedThread && accountId && latestTurnId && void run(() => api.interruptTurn(accountId, selectedThread.id, latestTurnId), "Turn interrupted.")}><CircleStop aria-hidden="true" size={16} strokeWidth={1.75} /></button></div><button className="primary-button chat-compose__send" type="submit" aria-label="Send" title="Send" disabled={!canSend}><Send aria-hidden="true" size={16} strokeWidth={2} /></button></div>
          </form>
        </section>
      </div>
      {document ? <MarkdownViewer document={document} onClose={closeMarkdown} /> : null}
      {openSubagent && accountId && openSubagentSettings ? <SubagentChatDialog accountId={accountId} reference={openSubagent} api={api} models={models} settings={openSubagentSettings} activeTurnKeys={activeTurnKeys} activeTurnIds={activeTurnIds} markTurnActive={markTurnActive} onSettingsChange={updateSubagentSettings} onOpenMarkdown={(path) => void openMarkdown(path)} onClose={() => setOpenSubagent(null)} report={report} reportError={reportError} /> : null}
      {moveOpen ? <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !moving) setMoveOpen(false); }}><section className="launch-dialog chat-move-dialog" role="dialog" aria-modal="true" aria-labelledby="move-chat-title" tabIndex={-1} ref={moveDialogRef} onKeyDown={(event) => { if (event.key === "Escape" && !moving) setMoveOpen(false); }}><OverlayCloseButton ref={moveCloseButton} disabled={moving} onClick={() => setMoveOpen(false)} /><h2 id="move-chat-title">Move to another account</h2><p>The original chat will remain on {accountId}. Swarm will attach its JSONL to a new chat on the selected account and ask it to continue from that session.</p>{continuationAccounts.length ? <fieldset className="chat-move-dialog__accounts"><legend>New chat account</legend>{continuationAccounts.map((account) => <label key={account.id}><input type="radio" name="continuation-account" value={account.id} checked={moveTarget === account.id} onChange={() => setMoveTarget(account.id)} />{account.id}</label>)}</fieldset> : <p>No other signed-in account is available.</p>}<div className="dialog-actions"><button className="primary-button" type="button" disabled={!moveTarget || moving} onClick={() => void moveToAccount()}>{moving ? "Moving…" : `Move to ${moveTarget ?? "account"}`}</button></div></section></div> : null}
    </section>
  );
}
