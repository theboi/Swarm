import { useEffect, useMemo, useRef, useState } from "react";

import type { AccountId, ApiResult, CoordinatorSnapshot, ThreadSummary, TranscriptItem } from "../../shared/contracts.js";
import type { CoordinatorApi, MarkdownDocument } from "../api.js";
import { MarkdownViewer } from "../components/MarkdownViewer.js";
import { TranscriptItemView } from "../components/TranscriptItemView.js";

type ChatsApi = Pick<CoordinatorApi, "readTranscript" | "readMarkdown" | "startTurn" | "startThread" | "archiveThread" | "steerTurn" | "interruptTurn" | "decideApproval">;

function initialAccount(snapshot: CoordinatorSnapshot, initialThreadId?: string | null): AccountId | null {
  return snapshot.threads.find((thread) => thread.id === initialThreadId)?.accountId ?? snapshot.accounts[0]?.id ?? null;
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

export function ChatsPage({ snapshot, api, initialThreadId, onRefresh = async () => undefined }: { snapshot: CoordinatorSnapshot; api: ChatsApi; initialThreadId?: string | null; onRefresh?: () => Promise<void> }) {
  const [accountId, setAccountId] = useState<AccountId | null>(() => initialAccount(snapshot, initialThreadId));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(() => initialThreadId ?? threadsFor(snapshot, initialAccount(snapshot, initialThreadId))[0]?.id ?? null);
  const [items, setItems] = useState<TranscriptItem[]>([]);
  const [transcriptRevision, setTranscriptRevision] = useState(0);
  const [draft, setDraft] = useState("");
  const [document, setDocument] = useState<MarkdownDocument | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollPosition = useRef(0);
  const compact = useCompactPicker();
  const threads = useMemo(() => threadsFor(snapshot, accountId), [snapshot, accountId]);
  const selectedThread = snapshot.threads.find((thread) => thread.id === threadId && thread.accountId === accountId) ?? null;
  const selectedAccount = snapshot.accounts.find((account) => account.id === accountId) ?? null;
  const terminalCommand = selectedAccount?.terminalCommand;
  const approvals = snapshot.pendingApprovals.filter((approval) => approval.accountId === accountId && approval.threadId === threadId);

  useEffect(() => {
    setThreadId((currentThreadId) => currentThreadId && threads.some((thread) => thread.id === currentThreadId) ? currentThreadId : threads[0]?.id ?? null);
  }, [threads]);

  useEffect(() => {
    if (!accountId || !threadId) { setItems([]); return; }
    let live = true;
    void api.readTranscript(accountId, threadId).then((result) => {
      if (!live) return;
      if ("error" in result && result.error) { setError(result.error.message); setItems([]); return; }
      setItems(result.data);
    }).catch(() => {
      if (!live) return;
      setError("Unable to load this chat.");
      setItems([]);
    });
    return () => { live = false; };
  }, [api, accountId, threadId, transcriptRevision]);

  const chooseAccount = (nextAccountId: AccountId) => {
    if (nextAccountId === accountId) { setPickerOpen((open) => !open); return; }
    setAccountId(nextAccountId);
    setPickerOpen(false);
  };

  const chooseThread = (nextThreadId: string) => { setThreadId(nextThreadId); setPickerOpen(false); };
  const report = (text: string) => { setError(null); setMessage(text); };
  const reportError = (text: string) => { setMessage(null); setError(text); };
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

  const latestTurnId = items.at(-1)?.turnId;
  return (
    <section className="chats-page" aria-labelledby="chats-title">
      <header><p className="eyebrow">App-server threads</p><h1 id="chats-title">Chats</h1></header>
      {message ? <p role="status">{message}</p> : null}{error ? <p role="alert">{error}</p> : null}
      <div className={`chat-account-picker ${compact ? "chat-account-picker--pills" : ""}`} aria-label="macOS accounts">
        {snapshot.accounts.map((account) => <button key={account.id} type="button" aria-pressed={account.id === accountId} onClick={() => chooseAccount(account.id)}>{account.id}</button>)}
      </div>
      <div className="chats-layout">
        {!compact || pickerOpen ? <aside className="thread-picker" aria-label="Chats for selected account">{threads.map((thread) => <button key={thread.id} type="button" aria-pressed={thread.id === threadId} onClick={() => chooseThread(thread.id)}>{thread.name ?? "Unnamed chat"}</button>)}</aside> : null}
        <section className="chat-panel" aria-label="Selected chat">
          <header className="chat-panel__header"><h2>{selectedThread?.name ?? "No chat selected"}</h2><div><button type="button" disabled={!accountId} onClick={() => accountId && void run(() => api.startThread(accountId), "New chat created.", (thread) => setThreadId(thread.id))}>New chat</button><button type="button" disabled={!selectedThread?.capabilities.canArchive || !accountId} onClick={() => selectedThread && accountId && void run(() => api.archiveThread(accountId, selectedThread.id), "Chat archived.")}>Archive chat</button>{terminalCommand ? <button type="button" onClick={() => void copyTerminalCommand()}>Copy open-terminal command</button> : null}</div></header>
          {approvals.map((approval) => <section className="chat-approval" key={approval.id} aria-labelledby={`approval-${approval.id}`}><h3 id={`approval-${approval.id}`}>Approval required</h3><p>{approval.summary}</p><div>{approval.availableDecisions.map((decision) => <button key={decision} type="button" onClick={() => void run(() => api.decideApproval(approval, decision), "Approval response sent.")}>{`${decision.charAt(0).toUpperCase()}${decision.slice(1)} approval`}</button>)}</div></section>)}
          <div className="transcript-scroll" data-testid="transcript-scroll" ref={scrollRef}>{items.map((item) => <TranscriptItemView item={item} key={item.id} onOpenMarkdown={(path) => void openMarkdown(path)} />)}</div>
          <form className="chat-compose" onSubmit={(event) => { event.preventDefault(); if (selectedThread && accountId && draft.trim()) void run(() => api.startTurn(accountId, selectedThread.id, draft), "Message sent."); }}>
            <label htmlFor="message">Message</label><textarea id="message" value={draft} onChange={(event) => setDraft(event.target.value)} />
            <button className="primary-button" type="submit" disabled={!selectedThread?.capabilities.canStartTurn}>Send</button>
            <button type="button" disabled={!selectedThread?.capabilities.canSteer || !accountId || !latestTurnId} onClick={() => selectedThread && accountId && latestTurnId && void run(() => api.steerTurn(accountId, selectedThread.id, latestTurnId, draft), "Turn steered.")}>Steer</button>
            <button type="button" disabled={!selectedThread?.capabilities.canInterrupt || !accountId || !latestTurnId} onClick={() => selectedThread && accountId && latestTurnId && void run(() => api.interruptTurn(accountId, selectedThread.id, latestTurnId), "Turn interrupted.")}>Interrupt</button>
          </form>
        </section>
      </div>
      {document ? <MarkdownViewer document={document} onClose={closeMarkdown} /> : null}
    </section>
  );
}
