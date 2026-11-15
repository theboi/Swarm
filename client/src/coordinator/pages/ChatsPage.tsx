import { useEdenModal } from "@/components/overlay/EdenOverlayProvider/useEdenModal";
import { EdenRadioCardGroup } from "@/components/primitives/EdenRadioCardGroup";
import { EdenButton } from "@/components/primitives/EdenButton/EdenButton";
import { EdenTextArea } from "@/components/primitives/EdenTextArea";
import { EdenListCard } from "@/components/primitives/EdenListCard";
import { EdenListCardItem } from "@/components/primitives/EdenListCard/EdenListCardItem";
import { EdenField } from "@/components/primitives/EdenField";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { EdenIcon } from "@/components/primitives/EdenIcon/EdenIcon";

import type { AccountId, ApiResult, ChatExecutionSettings, ChatModelOption, CoordinatorSnapshot, ThreadSummary, TranscriptItem } from "../../shared/contracts.js";
import type { MarkdownDocument } from "../api.js";
import type { ChatTarget } from "./HomePage.js";
import { SubagentChatDialog } from "./ChatsPage/SubagentChatDialog.js";
import { useChatDraft } from "./ChatsPage/useChatDraft.js";
import { subagentReferences, hasActiveDescendant } from "./ChatsPage/subagents.js";
import { turnIdFromStart, queuedTurnFromStart } from "./ChatsPage/turnStart.js";
import type { ChatsApi, SubagentReference } from "./ChatsPage/types.js";
import { MarkdownViewer } from "../components/MarkdownViewer.js";
import { TranscriptTurns, reconcileTranscript, type TranscriptHandle } from "../components/TranscriptTurns.js";
import { AccountUsageBar } from "../components/AccountSummaryPanel.js";
import { AccountStatusIndicator } from "../components/AccountStatusIndicator.js";
import { TurnOptions } from "../components/TurnOptions.js";
import { Toast } from "../components/Toast.js";
import { chatExecutionSettingsKey, defaultExecutionSettings, normalizeExecutionSettings, readChatExecutionSettings, readGlobalExecutionSettings, writeChatExecutionSettings, writeGlobalExecutionSettings } from "../turnSettings.js";

const EMPTY_TURN_KEYS: ReadonlySet<string> = new Set<string>();
const noopMarkThreadRead = () => undefined;





function settingsKey(accountId: AccountId | null, threadId: string | null, isDraftChat: boolean): string | null {
  return accountId && threadId && !isDraftChat ? chatExecutionSettingsKey(accountId, threadId) : null;
}


function initialAccount(snapshot: CoordinatorSnapshot, initialThreadId?: string | null, initialAccountId?: AccountId): AccountId | null {
  return snapshot.threads.find((thread) => thread.id === initialThreadId)?.accountId
    ?? snapshot.accounts.find((account) => account.id === initialAccountId)?.id
    ?? snapshot.accounts[0]?.id
    ?? null;
}

function threadsFor(snapshot: CoordinatorSnapshot, accountId: AccountId | null): ThreadSummary[] {
  return accountId ? snapshot.threads.filter((thread) => thread.accountId === accountId && !thread.archived) : [];
}

function wasTransferredFrom(snapshot: CoordinatorSnapshot, accountId: AccountId, threadId: string): boolean {
  return Boolean(
    snapshot.limitResumes?.some((record) => record.accountId === accountId && record.threadId === threadId && record.state === "transferred")
    || snapshot.workerAssignments?.some((assignment) => assignment.transferHistory.some((transfer) => transfer.fromAccountId === accountId && transfer.fromThreadId === threadId)),
  );
}

function isWaitingForLimit(snapshot: CoordinatorSnapshot, liveLimitExhaustedTurnKeys: ReadonlySet<string>, accountId: AccountId, threadId: string): boolean {
  const durable = snapshot.limitResumes?.find((record) => record.accountId === accountId && record.threadId === threadId);
  if (durable) return durable.state === "waiting_for_limit";
  return liveLimitExhaustedTurnKeys.has(`${accountId}\u0000${threadId}`) && !wasTransferredFrom(snapshot, accountId, threadId);
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




export function ChatsPage({ snapshot, api, initialThreadId, initialTarget, initialAccountId, openMarkdownPath = null, onOpenMarkdownPathChange, transcriptRevision: liveTranscriptRevision = 0, transcriptRevisions, activeTurnKeys = EMPTY_TURN_KEYS, activeTurnIds = new Map<string, string>(), limitExhaustedTurnKeys = EMPTY_TURN_KEYS, unreadTurnKeys = EMPTY_TURN_KEYS, attentionTurnKeys = EMPTY_TURN_KEYS, markTurnActive = () => undefined, markThreadRead = noopMarkThreadRead, onRefresh = async () => undefined }: { snapshot: CoordinatorSnapshot; api: ChatsApi; initialThreadId?: string | null; initialTarget?: ChatTarget; initialAccountId?: AccountId; openMarkdownPath?: string | null; onOpenMarkdownPathChange?: (path: string | null, accountId?: AccountId) => void; transcriptRevision?: number; transcriptRevisions?: ReadonlyMap<string, number>; activeTurnKeys?: ReadonlySet<string>; activeTurnIds?: ReadonlyMap<string, string>; limitExhaustedTurnKeys?: ReadonlySet<string>; unreadTurnKeys?: ReadonlySet<string>; attentionTurnKeys?: ReadonlySet<string>; markTurnActive?: (accountId: string, threadId: string, turnId?: string) => void; markThreadRead?: (accountId: string, threadId: string) => void; onRefresh?: () => Promise<void> }) {
  const requestedInitialThreadId = initialTarget?.threadId ?? initialThreadId;
  const requestedInitialAccountId = initialTarget?.accountId ?? initialAccountId;
  const [accountId, setAccountId] = useState<AccountId | null>(() => requestedInitialAccountId ?? initialAccount(snapshot, requestedInitialThreadId, initialAccountId));
  const [pickerOpen, setPickerOpen] = useState(() => !requestedInitialThreadId && !openMarkdownPath);
  const [threadId, setThreadId] = useState<string | null>(() => requestedInitialThreadId ?? threadsFor(snapshot, requestedInitialAccountId ?? initialAccount(snapshot, requestedInitialThreadId, initialAccountId))[0]?.id ?? null);
  const [isDraftChat, setIsDraftChat] = useState(false);
  const [createdThread, setCreatedThread] = useState<ThreadSummary | null>(null);
  const [threadsByAccount, setThreadsByAccount] = useState<Partial<Record<AccountId, ThreadSummary[]>>>(() => Object.fromEntries(snapshot.accounts.map((account) => [account.id, threadsFor(snapshot, account.id)])));
  const [loadingAccountId, setLoadingAccountId] = useState<AccountId | null>(null);
  const [pendingTarget, setPendingTarget] = useState<ChatTarget | null>(initialTarget ?? null);
  const [items, setItems] = useState<TranscriptItem[]>([]);
  const [transcriptRevision, setTranscriptRevision] = useState(0);
  const [scrollRequest, setScrollRequest] = useState(0);
  const [draft, setDraft] = useChatDraft(accountId, isDraftChat ? null : threadId);
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
  const [pendingSteer, setPendingSteer] = useState<{ accountId: AccountId; threadId: string; text: string } | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [resumeUpdating, setResumeUpdating] = useState(false);
  const [openSubagent, setOpenSubagent] = useState<SubagentReference | null>(null);
  const [subagentGraph, setSubagentGraph] = useState<ReadonlyMap<string, SubagentReference[]>>(() => new Map());
  const [clock, setClock] = useState(() => Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<TranscriptHandle>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const lastOpenedChatKey = useRef<string | null>(null);
  const scrollPosition = useRef(0);
  const openedMarkdownPath = useRef<string | null>(null);
  const openedMarkdownAccountId = useRef<AccountId | null>(null);
  const routedMarkdownSource = useRef<string | undefined>(undefined);
  const markdownRequestId = useRef(0);
  const markdownScrollRestoreTimers = useRef<number[]>([]);
  const selectedTranscriptKeyRef = useRef<string | null>(null);
  const itemsRef = useRef<TranscriptItem[]>([]);
  const transcriptRequestsRef = useRef(new Map<string, { running: boolean; pending: boolean; scrollOnSuccess: boolean }>());
  const compact = useCompactPicker();
  const conversationVisible = !compact || !pickerOpen;
  itemsRef.current = items;
  selectedTranscriptKeyRef.current = accountId && threadId && !isDraftChat && conversationVisible ? `${accountId}\u0000${threadId}` : null;
  const scopedTranscriptRevision = transcriptRevisions?.get(`${accountId}\u0000${threadId}`) ?? 0;
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
  const rememberSubagents = useCallback((parentThreadId: string, transcript: TranscriptItem[]) => {
    const references = subagentReferences(transcript, parentThreadId);
    setSubagentGraph((current) => {
      if (JSON.stringify(current.get(parentThreadId)) === JSON.stringify(references)) return current;
      const next = new Map(current);
      next.set(parentThreadId, references);
      return next;
    });
  }, []);

  useEffect(() => {
    const summaries = new Map(snapshot.threads.map((thread) => [`${thread.accountId}\u0000${thread.id}`, thread]));
    setThreadsByAccount((current) => {
      let changed = false;
      const next = { ...current };
      for (const [candidateAccountId, accountThreads] of Object.entries(current) as Array<[AccountId, ThreadSummary[] | undefined]>) {
        if (!accountThreads) continue;
        const reconciled = accountThreads.map((thread) => {
          const summary = summaries.get(`${candidateAccountId}\u0000${thread.id}`);
          if (!summary || JSON.stringify(summary) === JSON.stringify(thread)) return thread;
          changed = true;
          return summary;
        });
        if (changed) next[candidateAccountId] = reconciled;
      }
      return changed ? next : current;
    });
  }, [snapshot.threads]);

  useEffect(() => {
    if (!initialTarget) return;
    setPendingTarget(initialTarget);
    setPickerOpen(false);
    setAccountId(initialTarget.accountId);
    setThreadId(initialTarget.threadId);
    setIsDraftChat(false);
  }, [initialTarget?.accountId, initialTarget?.threadId]);

  useEffect(() => {
    if (initialTarget || !initialAccountId || openMarkdownPath) return;
    setPendingTarget(null);
    setAccountId(initialAccountId);
    setThreadId(null);
    setIsDraftChat(false);
  }, [initialAccountId, initialTarget?.accountId, initialTarget?.threadId, openMarkdownPath]);

  useEffect(() => {
    if (isDraftChat) return;
    if (pendingTarget) {
      if (threads.some((thread) => thread.accountId === pendingTarget.accountId && thread.id === pendingTarget.threadId)) setPendingTarget(null);
      return;
    }
    setThreadId((currentThreadId) => currentThreadId && threads.some((thread) => thread.id === currentThreadId) ? currentThreadId : threads[0]?.id ?? null);
  }, [isDraftChat, pendingTarget, threads]);

  useEffect(() => {
    if (!conversationVisible) return;
    if (!accountId || !threadId || isDraftChat) { selectedTranscriptKeyRef.current = null; setItems([]); return; }
    const openedKey = `${accountId}\u0000${threadId}`;
    selectedTranscriptKeyRef.current = openedKey;
    const shouldScrollToBottom = lastOpenedChatKey.current !== openedKey;
    if (shouldScrollToBottom) lastOpenedChatKey.current = openedKey;
    const requests = transcriptRequestsRef.current;
    const state = requests.get(openedKey) ?? { running: false, pending: false, scrollOnSuccess: false };
    requests.set(openedKey, state);
    state.pending = true;
    state.scrollOnSuccess ||= shouldScrollToBottom;
    const drain = async () => {
      if (state.running) return;
      state.running = true;
      try {
        while (state.pending) {
          state.pending = false;
          try {
            const result = await api.readTranscript(accountId, threadId);
            if (selectedTranscriptKeyRef.current !== openedKey) continue;
            if ("error" in result && result.error) { if (itemsRef.current.length === 0) setError(result.error.message); continue; }
            setItems((previous) => reconcileTranscript(previous, result.data));
            rememberSubagents(threadId, result.data);
            markThreadRead(accountId, threadId);
            if (state.scrollOnSuccess) {
              state.scrollOnSuccess = false;
              setScrollRequest((request) => request + 1);
            }
          } catch {
            if (selectedTranscriptKeyRef.current === openedKey && itemsRef.current.length === 0) setError("Unable to load this chat.");
          }
        }
      } finally {
        state.running = false;
        if (state.pending) void drain();
      }
    };
    void drain();
  }, [api, accountId, threadId, isDraftChat, markThreadRead, rememberSubagents, transcriptRevision, liveTranscriptRevision, scopedTranscriptRevision, conversationVisible]);

  useEffect(() => {
    if (!accountId || !threadId || isDraftChat || !conversationVisible) return;
    const key = `${accountId}\u0000${threadId}`;
    if (!unreadTurnKeys.has(key) && !attentionTurnKeys.has(key)) return;
    markThreadRead(accountId, threadId);
  }, [accountId, attentionTurnKeys, isDraftChat, markThreadRead, threadId, unreadTurnKeys, conversationVisible]);

  useLayoutEffect(() => {
    if (!scrollRequest || !scrollRef.current) return;
    const scroll = () => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; };
    scroll();
    const timer = window.setTimeout(scroll, 0);
    const settledTimer = window.setTimeout(scroll, 150);
    return () => { window.clearTimeout(timer); window.clearTimeout(settledTimer); };
  }, [scrollRequest, compact, pickerOpen]);

  useEffect(() => {
    if (!accountId || (!threadId && !isDraftChat) || (compact && pickerOpen)) return;
    const timer = window.setTimeout(() => composerRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [accountId, threadId, isDraftChat, compact, pickerOpen]);

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
    setPickerOpen(true);
    if (nextAccountId === accountId) return;
    setAccountId(nextAccountId);
    setIsDraftChat(false);
  };

  const chooseThread = (nextThreadId: string) => {
    if (nextThreadId === threadId && selectedThread) {
      if (compact) {
        setPickerOpen(false);
        return;
      }
      setRenameDraft(selectedThread.name?.trim() || "Unnamed chat");
      setRenameOpen(true);
      return;
    }
    setPendingSteer(null);
    setThreadId(nextThreadId);
    setIsDraftChat(false);
    setPickerOpen(false);
  };
  const beginDraftChat = () => {
    if (!accountId) return;
    setThreadId(null);
    lastOpenedChatKey.current = null;
    setCreatedThread(null);
    setItems([]);
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

  const openMarkdown = useCallback(async (path: string, updateRoute = true) => {
    if (!accountId) return;
    const requestId = ++markdownRequestId.current;
    scrollPosition.current = scrollRef.current?.scrollTop ?? 0;
    try {
      const result = await api.readMarkdown(accountId, path);
      if (requestId !== markdownRequestId.current) return;
      if ("error" in result && result.error) return reportError(result.error.message);
      setDocument(result.data);
      openedMarkdownPath.current = path;
      openedMarkdownAccountId.current = accountId;
      if (updateRoute) onOpenMarkdownPathChange?.(path, accountId);
    } catch {
      reportError("Unable to open this file.");
    }
  }, [accountId, api, onOpenMarkdownPathChange, reportError]);

  const closeMarkdown = () => {
    markdownRequestId.current += 1;
    const restoreScrollPosition = () => { if (scrollRef.current) scrollRef.current.scrollTop = scrollPosition.current; };
    for (const timer of markdownScrollRestoreTimers.current) window.clearTimeout(timer);
    markdownScrollRestoreTimers.current = [];
    restoreScrollPosition();
    markdownScrollRestoreTimers.current = [
      window.setTimeout(restoreScrollPosition, 0),
      window.setTimeout(restoreScrollPosition, 175),
    ];
    setDocument(null);
    openedMarkdownPath.current = null;
    openedMarkdownAccountId.current = null;
    onOpenMarkdownPathChange?.(null);
  };

  useEffect(() => () => {
    for (const timer of markdownScrollRestoreTimers.current) window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const source = `${accountId ?? ""}\u0000${openMarkdownPath ?? ""}`;
    if (routedMarkdownSource.current === source) return;
    const previousRoutePath = routedMarkdownSource.current?.split("\u0000")[1] ?? null;
    const accountChangedForOpenFile = previousRoutePath === openMarkdownPath && Boolean(openMarkdownPath);
    routedMarkdownSource.current = source;
    markdownRequestId.current += 1;
    if (!openMarkdownPath) {
      setDocument(null);
      openedMarkdownPath.current = null;
      openedMarkdownAccountId.current = null;
      return;
    }
    if (!accountId) return;
    if (openedMarkdownPath.current === openMarkdownPath && openedMarkdownAccountId.current === accountId) return;
    setDocument(null);
    void openMarkdown(openMarkdownPath, accountChangedForOpenFile);
  }, [accountId, openMarkdownPath, openMarkdown]);

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
    if (!accountId || !text || isWorking || resumeNeedsSignIn || (!isDraftChat && !selectedThread)) return;
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
        setDraft("", draft);
        await onRefresh();
        setTranscriptRevision((revision) => revision + 1);
        report("Message sent.");
        return;
      }
      const started = await api.startTurn(accountId, selectedThread!.id, text, turnSettings);
      if ("error" in started && started.error) return reportError(started.error.message);
      setDraft("", draft);
      if (queuedTurnFromStart(started.data)) {
        await onRefresh();
        report("Message queued for resume.");
        return;
      }
      markTurnActive(accountId, selectedThread!.id, turnIdFromStart(started.data));
      await onRefresh();
      setTranscriptRevision((revision) => revision + 1);
      report("Message sent.");
    } catch {
      reportError("Unable to start this chat. Check that this account is connected, then try again.");
    }
  };

  const steerMessage = async () => {
    const text = draft.trim();
    if (!accountId || !selectedThread || !activeTurnId || !text || !canSteer) return;
    const pending = { accountId, threadId: selectedThread.id, text };
    setDraft("", draft);
    setPendingSteer(pending);
    try {
      const result = await api.steerTurn(accountId, selectedThread.id, activeTurnId, text);
      if ("error" in result && result.error) {
        setPendingSteer(null);
        setDraft(text, "");
        reportError(result.error.message);
        return;
      }
      setPendingSteer(null);
      await onRefresh();
      setTranscriptRevision((revision) => revision + 1);
      report("Turn steered.");
    } catch {
      setPendingSteer(null);
      setDraft(text, "");
      reportError("Unable to steer this turn.");
    }
  };

  const activeTurnKey = accountId && threadId ? `${accountId}\u0000${threadId}` : "";
  const activeTurnId = activeTurnKey ? activeTurnIds.get(activeTurnKey) ?? selectedThread?.activeTurnId : undefined;
  const latestTurnId = activeTurnId ?? [...items].reverse().find((item) => item.turnId)?.turnId;
  const subagents = useMemo(() => subagentReferences(items, threadId), [items, threadId]);
  const activeThreadIds = new Set(threads.filter((thread) => thread.activity === "active").map((thread) => thread.id));
  const subagentThinking = Boolean(accountId && threadId && (subagents.some((subagent) => activeTurnKeys.has(`${accountId}\u0000${subagent.threadId}`)) || hasActiveDescendant(threadId, accountId, subagentGraph, activeTurnKeys, activeThreadIds)));
  const isThinking = Boolean(activeTurnKey && (activeTurnKeys.has(activeTurnKey) || selectedThread?.activity === "active" || subagentThinking));
  const isWorking = isThinking;
  const canSteer = Boolean(selectedThread && accountId && activeTurnId && (isThinking || selectedThread.capabilities.canSteer));
  const canInterrupt = Boolean(selectedThread && accountId && latestTurnId && (isThinking || selectedThread.capabilities.canInterrupt));
  const selectedChatName = isDraftChat ? "New chat" : selectedThread?.name ?? "No chat selected";
  const resumeNeedsSignIn = selectedAccount?.authentication === "unauthenticated" || selectedAccount?.connection === "action_required";
  const canSend = Boolean(accountId && (isDraftChat || selectedThread) && !isWorking && !resumeNeedsSignIn);
  const scrollToBottom = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  };
  const scrollToLatestUserMessage = () => {
    transcriptRef.current?.showLatestUserMessage();
  };
  const exhaustedLimit = selectedAccount?.rateLimits.filter((limit) => limit.usedPercent !== null && limit.usedPercent >= 100).sort((left, right) => (left.resetsAt ?? Number.MAX_SAFE_INTEGER) - (right.resetsAt ?? Number.MAX_SAFE_INTEGER))[0];
  const limitExhausted = Boolean(threadId && accountId && isWaitingForLimit(snapshot, limitExhaustedTurnKeys, accountId, threadId));
  const resumeEnabled = Boolean(threadId && accountId && snapshot.limitResumes?.some((record) => record.accountId === accountId && record.threadId === threadId && record.state !== "transferred"));
  const resumeCountdown = limitCountdown(exhaustedLimit?.resetsAt ?? null, clock);
  const resumeStatus = resumeNeedsSignIn && accountId
    ? `Sign in to ${accountId} before this chat can resume.`
    : resumeCountdown
      ? `Waiting for limit to reset in ${resumeCountdown} before resuming.`
      : "Waiting for usage availability before resuming. Retrying automatically.";
  const continuationAccounts = snapshot.accounts.filter((account) => account.id !== accountId && account.connection === "connected" && account.authentication === "authenticated");
  const liveReasoningId = isThinking && latestTurnId ? [...items].reverse().find((item) => item.turnId === latestTurnId && item.type === "reasoning" && Array.isArray(item.payload.summary) && item.payload.summary.some((part) => typeof part === "string" && part.trim()))?.id : undefined;
  const openSubagentSettings = openSubagent && accountId
    ? settingsByChat[chatExecutionSettingsKey(accountId, openSubagent.threadId)] ?? (models.length ? normalizeExecutionSettings(models, globalSettings) : defaultExecutionSettings(models))
    : null;

  const updateSubagentSettings = (next: ChatExecutionSettings) => {
    if (!openSubagent || !accountId) return;
    setSettingsByChat((current) => ({ ...current, [chatExecutionSettingsKey(accountId, openSubagent.threadId)]: next }));
    setGlobalSettings(next);
  };

  const toggleAutomaticResume = async () => {
    if (!accountId || !selectedThread || isDraftChat || resumeUpdating) return;
    setResumeUpdating(true);
    try {
      await run(
        () => api.setLimitResumeEnabled(accountId, selectedThread.id, !resumeEnabled),
        `Automatic resume ${resumeEnabled ? "disabled" : "enabled"}.`,
      );
    } finally {
      setResumeUpdating(false);
    }
  };

  useEffect(() => {
    if (!accountId || !threadId || isDraftChat || !conversationVisible) return;
    const refreshVisible = () => {
      if (globalThis.document.visibilityState === "visible") setTranscriptRevision((revision) => revision + 1);
    };
    // Realtime drives updates; a slow idle check also recovers missed starts.
    const timer = window.setInterval(refreshVisible, isThinking ? 2_500 : 30_000);
    globalThis.document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      if (timer !== undefined) window.clearInterval(timer);
      globalThis.document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [accountId, isDraftChat, isThinking, threadId, conversationVisible]);

  useEffect(() => {
    if (!limitExhausted) return;
    setClock(Date.now());
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [limitExhausted]);



  const openMove = () => {
    const first = continuationAccounts[0]?.id ?? null;
    setMoveTarget(first);
    setMoveOpen(true);
  };

  const moveToAccount = async () => {
    if (!accountId || !threadId || !moveTarget || !api.moveThreadToAccount) return;
    setMoving(true);
    try {
      const turnSettings = normalizeExecutionSettings(models, executionSettings);
      const result = await api.moveThreadToAccount(accountId, threadId, moveTarget, turnSettings);
      if ("error" in result && result.error) return reportError(result.error.message);
      setSettingsByChat((current) => ({ ...current, [chatExecutionSettingsKey(moveTarget, result.data.id)]: turnSettings }));
      setGlobalSettings(turnSettings);
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

  const renameChat = async () => {
    const name = renameDraft.trim();
    if (!accountId || !selectedThread || !name || !api.renameThread) return;
    setRenaming(true);
    try {
      const result = await api.renameThread(accountId, selectedThread.id, name);
      if ("error" in result && result.error) return reportError(result.error.message);
      setThreadsByAccount((current) => ({ ...current, [accountId]: (current[accountId] ?? []).map((thread) => thread.id === selectedThread.id ? { ...thread, name } : thread) }));
      if (createdThread?.id === selectedThread.id) setCreatedThread({ ...createdThread, name });
      setRenameOpen(false);
      report("Chat renamed.");
    } catch { reportError("Unable to rename this chat."); }
    finally { setRenaming(false); }
  };

  const fileModal = useEdenModal({
    title: document?.filename ?? "File", size: "wide", open: Boolean(document),
    onClose: closeMarkdown, content: document ? <MarkdownViewer document={document} /> : null,
  });
  const subagentModal = useEdenModal({
    title: openSubagent ? `Subagent ${openSubagent.label}` : "Subagent", size: "wide",
    open: Boolean(openSubagent && accountId && openSubagentSettings),
    onClose: () => setOpenSubagent(null), content: openSubagent && accountId && openSubagentSettings ? <SubagentChatDialog accountId={accountId} reference={openSubagent} api={api} models={models} settings={openSubagentSettings} activeTurnKeys={activeTurnKeys} activeTurnIds={activeTurnIds} markTurnActive={markTurnActive} onSettingsChange={updateSubagentSettings} onTranscript={rememberSubagents} onOpenMarkdown={(path) => void openMarkdown(path)} report={report} reportError={reportError} /> : null,
  });
  const moveModal = useEdenModal({
    title: "Move to another account", open: moveOpen, dismissible: !moving,
    onClose: () => setMoveOpen(false),
    description: `The original chat will remain on ${accountId}. Swarm will attach its JSONL to a new chat on the selected account and ask it to continue from that session.`,
    content: continuationAccounts.length ? <EdenRadioCardGroup label="New chat account" name="continuation-account" value={moveTarget ?? ""} disabled={moving}
      options={continuationAccounts.map(account => ({ value: account.id, label: account.id }))}
      onValueChange={value => { const account = continuationAccounts.find(account => account.id === value); if (account) setMoveTarget(account.id); }} /> : <p>No other signed-in account is available.</p>,
    actionButtons: <EdenButton density="superCompact" appearance="borderless" isFloating={false} disabled={!moveTarget || moving} onClick={() => void moveToAccount()}>{moving ? "Moving…" : `Move to ${moveTarget ?? "account"}`}</EdenButton>,
  });
  const renameModal = useEdenModal({
    title: "Rename chat", size: "compact", open: renameOpen, dismissible: !renaming,
    onClose: () => setRenameOpen(false),
    content: <EdenField label="Chat name" value={renameDraft} onChange={event => setRenameDraft(event.target.value)} />,
    actionButtons: <EdenButton density="superCompact" appearance="borderless" isFloating={false} disabled={!renameDraft.trim() || renaming} onClick={() => void renameChat()}>{renaming ? "Renaming…" : "Rename"}</EdenButton>,
  });
  return (
    <section className="chats-page" aria-label="Chat workspace">
      {message ? <Toast onDismiss={() => setMessage(null)}>{message}</Toast> : null}
      {error ? <Toast tone="error" onDismiss={() => setError(null)}>{error}</Toast> : null}
      <div className="chats-workspace" data-picker-open={pickerOpen}>
        <nav className={`chat-account-picker ${compact ? "chat-account-picker--pills" : ""}`} aria-label="Accounts">
          <div className="chat-account-picker__heading"><span>Accounts</span><span>{snapshot.accounts.length}</span></div>
          {snapshot.accounts.map((account) => {
            const accountThreads = threadsByAccount[account.id] ?? threadsFor(snapshot, account.id);
            const accountActiveThreadIds = new Set(accountThreads.filter((thread) => thread.activity === "active").map((thread) => thread.id));
            const accountThinking = accountThreads.some((thread) => thread.activity === "active" || activeTurnKeys.has(`${thread.accountId}\u0000${thread.id}`))
              || [...activeTurnKeys].some((key) => key.startsWith(`${account.id}\u0000`))
              || accountThreads.some((thread) => hasActiveDescendant(thread.id, account.id, subagentGraph, activeTurnKeys, accountActiveThreadIds));
            const accountLimitHit = !accountThinking && account.connection === "connected" && account.authentication === "authenticated"
              && (snapshot.limitResumes?.some((record) => record.accountId === account.id && record.state === "waiting_for_limit") ?? false);
            const accountHasUnread = accountThreads.some((thread) => unreadTurnKeys.has(`${account.id}\u0000${thread.id}`));
            const accountNeedsAttention = [...attentionTurnKeys].some((key) => key.startsWith(`${account.id}\u0000`));
            return <button key={account.id} type="button" aria-label={account.id} aria-pressed={account.id === accountId} onClick={() => chooseAccount(account.id)}><AccountStatusIndicator account={account} working={accountThinking} waitingForLimit={accountLimitHit} /><span>{account.id}</span>{accountHasUnread ? <span className="notification-dot chat-account-picker__notification" role="img" aria-label={`${account.id} has unread replies`} /> : accountNeedsAttention ? <span className="notification-dot chat-account-picker__notification" role="img" aria-label={`${account.id} needs attention`} /> : null}</button>;
          })}
        </nav>
        {!compact || pickerOpen ? <aside className="thread-picker" aria-label={`Chats for ${accountId ?? "selected account"}`}>
          <EdenButton density="compact" appearance="primary" isFloating={false} className="thread-picker__new" type="button" disabled={!accountId} onClick={beginDraftChat}><EdenIcon name="plus" aria-hidden="true" size={16} strokeWidth={2} /><span>New chat</span></EdenButton>
          <div className="thread-picker__list"><EdenListCard sections={{ chats: { title: "Chats", items: threads, emptyState: loadingAccountId === accountId ? <div className="thread-picker__loading" role="status" aria-label="Loading chats"><span className="loading-spinner" aria-hidden="true" /><span>Loading chats…</span></div> : "No chats for this account." } }} getItemKey={(thread) => thread.id} renderItem={(thread) => {
            const name = thread.name ?? "Unnamed chat";
            const threadKey = `${thread.accountId}\u0000${thread.id}`;
            const thinking = activeTurnKeys.has(threadKey) || thread.activity === "active" || (thread.id === threadId && subagentThinking) || hasActiveDescendant(thread.id, thread.accountId, subagentGraph, activeTurnKeys, activeThreadIds);
            const waitingForLimit = isWaitingForLimit(snapshot, limitExhaustedTurnKeys, thread.accountId, thread.id);
            const hasUnread = unreadTurnKeys.has(threadKey);
            const needsAttention = attentionTurnKeys.has(threadKey);
            const status = thinking ? "Thinking" : waitingForLimit ? "Waiting for limit" : thread.capabilities.canSteer ? "Working" : "Ready for messages";
            return <EdenListCardItem aria-label={name} title={name} selected={thread.id === threadId} onClick={() => chooseThread(thread.id)}
              leading={thinking ? <span className="loading-spinner" role="img" aria-label={`${name} working`} /> : <EdenIcon name="messageSquarePlus" aria-hidden="true" size={16} />}
              metadata={<span className="thread-picker__status">{status}</span>}
              trailing={<span className="thread-picker__trailing">{hasUnread ? <span className="notification-dot" role="img" aria-label={`${name} has an unread reply`} /> : needsAttention ? <span className="notification-dot" role="img" aria-label={`${name} needs attention`} /> : null}<EdenIcon name="chevronRight" aria-hidden="true" size={16} /></span>} />;
          }} /></div>
          {selectedAccount ? <footer className="thread-picker__usage"><AccountUsageBar account={selectedAccount} showLabels /></footer> : null}
        </aside> : null}
        <section className="chat-panel" hidden={compact && pickerOpen} aria-label={selectedChatName}>
          <header className="chat-panel__header">
            {compact ? <EdenButton className="chat-panel__back" density="superCompact" appearance="borderless" isFloating={false} aria-label="Back to chats" onClick={() => setPickerOpen(true)}><EdenIcon name="arrowLeft" aria-hidden="true" size={16} />Chats</EdenButton> : null}
            <div className="chat-panel__title"><span className="chat-panel__account">{accountId ?? "No account"}</span><h2 id="selected-chat-title">{selectedChatName}</h2>{isThinking ? <span className="chat-thinking" aria-label="Codex is thinking"><span className="loading-spinner" aria-hidden="true" />Thinking</span> : null}</div>
            <div className="chat-panel__tools"><EdenButton density="superCompact" appearance="borderless" isFloating={false} className={`chat-tool${resumeEnabled ? " chat-tool--primary" : ""}`} type="button" aria-label={`${resumeEnabled ? "Disable" : "Enable"} automatic resume`} aria-pressed={resumeEnabled} title={`${resumeEnabled ? "Disable" : "Enable"} automatic resume`} disabled={!selectedThread || !accountId || isDraftChat || resumeUpdating} onClick={() => void toggleAutomaticResume()}>Auto-resume <span aria-hidden="true">{resumeEnabled ? "On" : "Off"}</span></EdenButton><EdenButton density="superCompact" appearance="borderless" isFloating={false} className="chat-tool chat-tool--icon" type="button" aria-label="Archive chat" title="Archive chat" disabled={!selectedThread || !accountId || isDraftChat} onClick={() => selectedThread && accountId && void run(() => api.archiveThread(accountId, selectedThread.id), "Chat archived.", () => { setThreadsByAccount((current) => ({ ...current, [accountId]: (current[accountId] ?? []).filter((thread) => thread.id !== selectedThread.id) })); if (createdThread?.id === selectedThread.id) setCreatedThread(null); })}><EdenIcon name="archive" aria-hidden="true" size={17} strokeWidth={1.75} /></EdenButton><EdenButton density="superCompact" appearance="borderless" isFloating={false} className="chat-tool chat-tool--icon" type="button" aria-label="Move to another account" title="Move to another account" disabled={!selectedThread || !accountId || isDraftChat || !api.moveThreadToAccount} onClick={openMove}><EdenIcon name="arrowRightLeft" aria-hidden="true" size={17} strokeWidth={1.75} /></EdenButton>{terminalCommand ? <EdenButton density="superCompact" appearance="borderless" isFloating={false} className="chat-tool chat-tool--icon" type="button" aria-label="Copy open-terminal command" title="Copy open-terminal command" onClick={() => void copyTerminalCommand()}><EdenIcon name="squareTerminal" aria-hidden="true" size={17} strokeWidth={1.75} /></EdenButton> : null}</div>
          </header>
          {approvals.length ? <div className="chat-approvals">{approvals.map((approval) => <section className="chat-approval" key={approval.id} aria-label="Approval required"><div className="chat-approval__copy"><h3 id={`approval-${approval.id}`}>Approval required</h3><p>{approval.summary}</p></div><div className="chat-approval__actions">{approval.availableDecisions.map((decision) => {
            const permissions = isPermissionGrant(decision) ? approval.requestedPermissions : undefined;
            const missingPermissions = isPermissionGrant(decision) && (!permissions || Object.keys(permissions).length === 0);
            return <EdenButton density="superCompact" appearance="borderless" isFloating={false} key={decision} type="button" disabled={missingPermissions} onClick={() => void run(() => api.decideApproval(approval, decision, permissions), "Approval response sent.")}>{approvalLabel(decision)}</EdenButton>;
          })}</div></section>)}</div> : null}
          {subagents.length ? <nav className="subagent-pills" aria-label="Subagents">{subagents.map((subagent) => <EdenButton density="superCompact" appearance="borderless" isFloating={false} className="subagent-pill" key={subagent.threadId} type="button" aria-label={`Open subagent ${subagent.label}`} onClick={() => setOpenSubagent(subagent)}><EdenIcon name="network" aria-hidden="true" size={14} strokeWidth={1.75} /><span>{subagent.label}</span>{activeTurnKeys.has(`${accountId}\u0000${subagent.threadId}`) || activeThreadIds.has(subagent.threadId) ? <span className="loading-spinner" aria-label={`${subagent.label} working`} role="img" /> : null}</EdenButton>)}</nav> : null}
          <div className="transcript-region"><div className="transcript-scroll" data-testid="transcript-scroll" ref={scrollRef} aria-label="Conversation">{items.length ? <TranscriptTurns ref={transcriptRef} key={`${accountId}:${threadId}`} items={items} activeReasoningId={liveReasoningId} onOpenMarkdown={openMarkdown} /> : <div className="transcript-empty"><EdenIcon name="messageSquarePlus" aria-hidden="true" size={20} strokeWidth={1.5} /><p>{isDraftChat ? "Your chat will be created when you send the first message." : selectedThread ? "No messages in this chat yet." : "Choose a chat to view its messages."}</p></div>}{isThinking && !liveReasoningId ? <div className="transcript-working" aria-label="Codex is working"><span className="loading-spinner" aria-hidden="true" /><span>Thinking… Live updates will appear here.</span></div> : null}</div><div className="transcript-jump-controls" aria-label="Chat scroll controls"><EdenButton density="superCompact" appearance="borderless" isFloating={false} type="button" aria-label="Scroll to latest message you sent" title="Latest message you sent" disabled={!items.some((item) => item.type === "userMessage")} onClick={scrollToLatestUserMessage}><EdenIcon name="userRound" aria-hidden="true" size={15} /></EdenButton><EdenButton density="superCompact" appearance="borderless" isFloating={false} type="button" aria-label="Scroll to bottom" title="Scroll to bottom" onClick={scrollToBottom}><EdenIcon name="arrowDown" aria-hidden="true" size={16} /></EdenButton></div></div>
          {limitExhausted ? <section className="chat-limit-notice" aria-label="Session limit reached" role="status"><p>{resumeStatus}</p></section> : null}
          {resumeNeedsSignIn && !limitExhausted && accountId ? <section className="chat-limit-notice" aria-label="Account sign-in required" role="status"><p>{`Sign in to ${accountId} to send messages.`}</p></section> : null}
          <form className="chat-compose" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
            {pendingSteer && pendingSteer.accountId === accountId && pendingSteer.threadId === selectedThread?.id ? <section className="pending-steer" role="status" aria-label="Pending steer"><p>{pendingSteer.text}</p><div><EdenButton density="superCompact" appearance="borderless" isFloating={false} type="button" aria-label="Edit pending steer" title="Edit" onClick={() => { setDraft(pendingSteer.text); setPendingSteer(null); composerRef.current?.focus(); }}><EdenIcon name="pencil" aria-hidden="true" size={14} /></EdenButton><EdenButton density="superCompact" appearance="borderless" isFloating={false} type="button" aria-label="Cancel pending steer" title="Cancel" onClick={() => setPendingSteer(null)}><EdenIcon name="x" aria-hidden="true" size={14} /></EdenButton></div></section> : null}
            <div className="chat-compose__field"><EdenTextArea ref={composerRef} id="message" aria-label="Message" rows={2} resize="none" autoResize maxAutoHeight={200} style={{ maxHeight: "30dvh" }} disabled={!accountId || (!isDraftChat && !selectedThread)} placeholder={isWorking ? "Steer this turn…" : "Work with Swarm..."} value={draft} onChange={(event) => setDraft(event.target.value)} /></div>
            <div className="chat-compose__footer"><div className="chat-compose__turn-actions"><TurnOptions models={models} settings={executionSettings} onChange={updateExecutionSettings} /><EdenButton density="superCompact" appearance="borderless" isFloating={false} type="button" aria-label="Steer" title="Steer" disabled={!canSteer} onClick={() => void steerMessage()}><EdenIcon name="cornerUpRight" aria-hidden="true" size={16} strokeWidth={1.75} /></EdenButton><EdenButton density="superCompact" appearance="borderless" isFloating={false} type="button" aria-label="Interrupt" title="Interrupt" disabled={!canInterrupt} onClick={() => selectedThread && accountId && latestTurnId && void run(() => api.interruptTurn(accountId, selectedThread.id, latestTurnId), "Turn interrupted.")}><EdenIcon name="circleStop" aria-hidden="true" size={16} strokeWidth={1.75} /></EdenButton></div><EdenButton density="superCompact" appearance="borderless" isFloating={false} className="chat-compose__send" type="submit" aria-label="Send" title="Send" disabled={!canSend}><EdenIcon name="send" aria-hidden="true" size={16} strokeWidth={2} /></EdenButton></div>
          </form>
        </section>
      </div>
      {fileModal.modal}{subagentModal.modal}{moveModal.modal}{renameModal.modal}
    </section>
  );
}
