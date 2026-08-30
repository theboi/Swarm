import { useEffect, useRef, useState } from "react";

import type { AccountId, ChatExecutionSettings, ChatModelOption, CoordinatorSnapshot, DispatchRecord, GitSyncStatus, LaunchAccountOption, TaskNode } from "../../shared/contracts.js";
import type { CoordinatorApi, LaunchPreview } from "../api.js";
import { AccountSummaryPanel } from "../components/AccountSummaryPanel.js";
import { OverlayCloseButton } from "../components/OverlayCloseButton.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { TurnOptions } from "../components/TurnOptions.js";
import { Toast } from "../components/Toast.js";
import { normalizeExecutionSettings, phaseDefaultExecutionSettings, saveThreadExecutionSettings, writeGlobalExecutionSettings } from "../turnSettings.js";

type HomeApi = Pick<CoordinatorApi, "previewLaunch" | "launch"> & Partial<Pick<CoordinatorApi, "listModels">>;
export type ChatTarget = Pick<DispatchRecord, "accountId" | "threadId">;

function isActiveDispatch(state: string): boolean {
  return state === "submitting" || state === "accepted";
}

function ActiveWork({ snapshot, dispatchId }: { snapshot: CoordinatorSnapshot; dispatchId: string }) {
  const dispatch = snapshot.dispatches.find((candidate) => candidate.id === dispatchId);
  if (!dispatch) return null;
  const task = snapshot.tasks.find((candidate) => candidate.id === dispatch.taskId);
  return <article className="active-work-row"><p>Account: {dispatch.accountId}</p><p>Worker: Not reported</p><p>Task: {task ? `${task.id} · ${task.title}` : "Unknown"}</p><p>Phase: {task?.readiness.phase ?? "Unknown"}</p><p>Live state: {dispatch.state}</p></article>;
}

function GitSyncWarning({ status }: { status: GitSyncStatus | undefined }) {
  if (status?.state !== "warning") return null;
  return <span role="img" aria-label={`Git ${status.action} warning`} title={status.message ?? `Git ${status.action} failed.`}>⚠</span>;
}

export function LaunchDialog({ preview, onClose, onSend, onSelectAccount, listModels }: { preview: LaunchPreview; onClose: () => void; onSend: (prompt: string, settings: ChatExecutionSettings) => Promise<void>; onSelectAccount: (accountId: AccountId) => Promise<void>; listModels?: CoordinatorApi["listModels"] }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const [prompt, setPrompt] = useState(preview.prompt);
  const [models, setModels] = useState<ChatModelOption[]>([]);
  const [settings, setSettings] = useState<ChatExecutionSettings>(() => phaseDefaultExecutionSettings([], preview.task.readiness.phase));
  const options: LaunchAccountOption[] = preview.accounts ?? [{ id: preview.accountId as AccountId, activeWorkers: 0, available: true }];
  const selectedOption = options.find((account) => account.id === preview.accountId);
  useEffect(() => closeButton.current?.focus(), []);
  useEffect(() => setPrompt(preview.prompt), [preview.prompt]);
  useEffect(() => setSettings(phaseDefaultExecutionSettings([], preview.task.readiness.phase)), [preview.task.id, preview.task.readiness.phase]);
  useEffect(() => {
    let live = true;
    setModels([]);
    if (!listModels) return () => { live = false; };
    void listModels(preview.accountId).then((result) => {
      if (!live || ("error" in result && result.error)) return;
      setModels(result.data);
      setSettings(phaseDefaultExecutionSettings(result.data, preview.task.readiness.phase));
    }).catch(() => undefined);
    return () => { live = false; };
  }, [listModels, preview.accountId, preview.task.readiness.phase]);
  const updateSettings = (next: ChatExecutionSettings) => { setSettings(next); writeGlobalExecutionSettings(next); };
  const taskReady = preview.task.readiness.state === "ready";
  const readinessLabel = preview.task.readiness.state.replaceAll("_", " ");
  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <section className="launch-dialog launch-dialog--review" role="dialog" aria-modal="true" aria-labelledby="launch-dialog-title" onMouseDown={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Escape") onClose(); if (event.key === "Tab") { const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled]), textarea:not([disabled])')]; const first = focusable[0]; const last = focusable.at(-1); if (!first || !last) return; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } } }}>
        <OverlayCloseButton ref={closeButton} onClick={onClose} />
        <header className="launch-dialog__header"><p className="eyebrow">Review launch</p><h2 id="launch-dialog-title">Launch {preview.task.id}</h2></header>
        <dl>
          <dt>Phase</dt><dd>{preview.task.readiness.phase.toUpperCase()}</dd>
          <dt>Dependencies</dt><dd>{preview.dependencies.length ? preview.dependencies.join(", ") : "None reported"}</dd>
        </dl>
        <div className="launch-dialog__field"><label htmlFor="launch-account">Account</label><select id="launch-account" className={selectedOption?.activeWorkers === 0 ? "launch-account-select launch-account-select--idle" : "launch-account-select"} value={preview.accountId} onChange={(event) => void onSelectAccount(event.target.value as AccountId)}>{options.map((account) => <option key={account.id} value={account.id} disabled={!account.available}>{`${account.id} — ${account.activeWorkers} worker${account.activeWorkers === 1 ? "" : "s"}${account.available ? "" : " — unavailable"}`}</option>)}</select><p className={selectedOption?.activeWorkers === 0 ? "launch-account-capacity launch-account-capacity--idle" : "launch-account-capacity"} aria-live="polite">{selectedOption?.activeWorkers === 0 ? "No unarchived chats" : `${selectedOption?.activeWorkers ?? 0} unarchived chat${selectedOption?.activeWorkers === 1 ? "" : "s"}`}</p></div>
        <div className="chat-compose launch-compose"><label className="launch-compose__label" htmlFor="launch-worker-prompt">Worker prompt</label><div className="chat-compose__field"><textarea id="launch-worker-prompt" className="launch-prompt-editor" value={prompt} onChange={(event) => setPrompt(event.target.value)} /></div><TurnOptions models={models} settings={settings} onChange={updateSettings} />{taskReady ? null : <p id="launch-send-readiness">You can review this launch now. Send becomes available when the task is ready; current state: {readinessLabel}.</p>}<div className="chat-compose__footer chat-compose__footer--send-only"><button className="primary-button launch-compose__send" type="button" aria-describedby={taskReady ? undefined : "launch-send-readiness"} disabled={!taskReady || !selectedOption?.available || !prompt.trim()} onClick={() => void onSend(prompt, normalizeExecutionSettings(models, settings))}>Send to {preview.accountId}</button></div></div>
      </section>
    </div>
  );
}

function LaunchReviewLoading({ task, onClose }: { task: TaskNode; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => closeButton.current?.focus(), []);
  return <div className="dialog-backdrop" onMouseDown={onClose}><section className="launch-dialog launch-dialog--review launch-dialog--loading" role="dialog" aria-modal="true" aria-labelledby="launch-loading-title" onMouseDown={(event) => event.stopPropagation()}><OverlayCloseButton ref={closeButton} onClick={onClose} /><header className="launch-dialog__header"><p className="eyebrow">Review launch</p><h2 id="launch-loading-title">Review launch {task.id}</h2></header><div className="launch-dialog__loading" role="status" aria-label="Loading launch preview"><span className="loading-spinner" aria-hidden="true" /><span>Preparing worker prompt and accounts…</span></div></section></div>;
}

export function HomePage({ snapshot, api, onOpenAccountChat, onOpenChat = () => undefined, onViewAccounts = () => undefined, onRefreshUsage }: { snapshot: CoordinatorSnapshot; api: HomeApi; onOpenAccountChat?: (accountId: AccountId) => void; onOpenChat?: (target: ChatTarget) => void; onViewAccounts?: () => void; onRefreshUsage?: () => Promise<void> }) {
  const [preview, setPreview] = useState<LaunchPreview | null>(null);
  const [reviewingTask, setReviewingTask] = useState<TaskNode | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const launchTrigger = useRef<HTMLElement | null>(null);
  const ready = snapshot.tasks.filter((task) => task.readiness.state === "ready");
  const blocked = snapshot.tasks.filter((task) => task.readiness.state === "blocked" || task.readiness.state === "attention_required");
  const active = snapshot.dispatches.filter((dispatch) => isActiveDispatch(dispatch.state));
  const queued = snapshot.dispatches.filter((dispatch) => dispatch.state === "queued" || dispatch.state === "waiting_for_limit");
  const blockedAttention = snapshot.tasks.filter((task) => task.readiness.state === "blocked" || task.readiness.state === "attention_required").length + snapshot.pendingApprovals.length;

  const reviewLaunch = async (task: TaskNode, accountId?: AccountId) => {
    setError(null);
    setPreview(null);
    setReviewingTask(task);
    try {
      const result = await api.previewLaunch(task.id, accountId);
      if ("error" in result && result.error) { setReviewingTask(null); return setError(result.error.message); }
      setPreview(result.data);
      setReviewingTask(null);
    } catch {
      setReviewingTask(null);
      setError("Unable to review this launch.");
    }
  };

  const send = async (prompt: string, settings: ChatExecutionSettings) => {
    if (!preview) return;
    try {
      const result = await api.launch(preview.task.id, preview.accountId, prompt, settings);
      if ("error" in result && result.error) return setError(result.error.message);
      setPreview(null);
      saveThreadExecutionSettings(result.data.accountId, result.data.threadId, settings);
      onOpenChat({ accountId: result.data.accountId, threadId: result.data.threadId });
    } catch {
      setError("Unable to send this work.");
    }
  };

  const closePreview = () => { setPreview(null); setReviewingTask(null); };
  useEffect(() => {
    if (!preview) launchTrigger.current?.focus();
  }, [preview]);

  return (
    <section className="home-page" aria-labelledby="home-title">
      <header><p className="eyebrow">Operating cockpit</p><h1 id="home-title">Home</h1></header>
      {message ? <Toast onDismiss={() => setMessage(null)}>{message}</Toast> : null}
      {error ? <Toast tone="error" onDismiss={() => setError(null)}>{error}</Toast> : null}
      <dl className="metric-grid">
        <div><dt>Active</dt><dd>{active.length}</dd></div><div><dt>Ready</dt><dd>{ready.length}</dd></div><div><dt>Queue</dt><dd>{queued.length}</dd></div><div><dt>Blocked / attention</dt><dd>{blockedAttention}</dd></div>
      </dl>
      <div className="home-dashboard">
        <div className="home-work">
          <section aria-labelledby="active-work-title"><h2 id="active-work-title">Active work</h2>{active.length ? active.map((dispatch) => <ActiveWork key={dispatch.id} snapshot={snapshot} dispatchId={dispatch.id} />) : <p>No active work reported.</p>}</section>
          <section aria-labelledby="ready-title"><h2 id="ready-title">Next ready work</h2><div className="work-list">{ready.length ? ready.map((task) => <article className="ready-task" key={task.id}><div><StatusBadge state={task.readiness.state} phase={task.readiness.phase} /><h3>{task.id} · {task.title}</h3></div><button type="button" onClick={(event) => { launchTrigger.current = event.currentTarget; void reviewLaunch(task); }}>Review launch for {task.id}</button></article>) : <p>No launchable work reported.</p>}</div></section>
          <section aria-labelledby="blocked-work-title"><h2 id="blocked-work-title">Blocked work</h2><div className="work-list">{blocked.length ? blocked.map((task) => <article className="blocked-task" key={task.id}><div><StatusBadge state={task.readiness.state} phase={task.readiness.phase} /><h3>{task.id} · {task.title}</h3><p>{task.readiness.blockingCodes.length ? task.readiness.blockingCodes.join(", ") : "Coordinator attention required"}</p></div></article>) : <p>No blocked work reported.</p>}</div></section>
          <section aria-labelledby="approvals-title"><h2 id="approvals-title">Attention queue</h2>{snapshot.pendingApprovals.length ? snapshot.pendingApprovals.map((approval) => <article key={approval.id}><p>{approval.summary}</p><small>{approval.accountId} · {approval.method}</small></article>) : <p>No pending approvals reported.</p>}</section>
        </div>
        <AccountSummaryPanel accounts={snapshot.accounts} assignments={snapshot.workerAssignments} tasks={snapshot.tasks} onOpenAccountChat={onOpenAccountChat} onViewMore={onViewAccounts} onRefreshUsage={onRefreshUsage} />
      </div>
      {preview ? <LaunchDialog preview={preview} onClose={closePreview} onSend={send} onSelectAccount={(accountId) => reviewLaunch(preview.task, accountId)} listModels={api.listModels} /> : null}
      {reviewingTask && !preview ? <LaunchReviewLoading task={reviewingTask} onClose={closePreview} /> : null}
    </section>
  );
}
