import { useEffect, useRef, useState } from "react";

import type { AccountSnapshot, CoordinatorSnapshot, RateLimitWindow, TaskNode } from "../../shared/contracts.js";
import type { CoordinatorApi, LaunchPreview } from "../api.js";
import { RateLimitBar } from "../components/RateLimitBar.js";
import { StatusBadge } from "../components/StatusBadge.js";

type HomeApi = Pick<CoordinatorApi, "previewLaunch" | "launch">;

function windowFor(account: AccountSnapshot, pattern: RegExp): RateLimitWindow | undefined {
  return account.rateLimits.find((window) => pattern.test(window.label) || pattern.test(window.id));
}

function isActiveDispatch(state: string): boolean {
  return state === "submitting" || state === "accepted";
}

function ngrokCopy(snapshot: CoordinatorSnapshot): string {
  if (snapshot.ngrok.state === "running") return "Public until 00:00";
  if (snapshot.ngrok.state === "error") return snapshot.ngrok.message ?? "Public access is unavailable.";
  if (snapshot.ngrok.state === "disabled") return "Public access is disabled.";
  return "Public access starts at 10:00";
}

function ActiveWork({ snapshot, dispatchId }: { snapshot: CoordinatorSnapshot; dispatchId: string }) {
  const dispatch = snapshot.dispatches.find((candidate) => candidate.id === dispatchId);
  if (!dispatch) return null;
  const task = snapshot.tasks.find((candidate) => candidate.id === dispatch.taskId);
  return <article className="active-work-row"><p>Account: {dispatch.accountId}</p><p>Worker: Not reported</p><p>Task: {task ? `${task.id} · ${task.title}` : "Unknown"}</p><p>Phase: {task?.readiness.phase ?? "Unknown"}</p><p>Live state: {dispatch.state}</p></article>;
}

function AccountCard({ account }: { account: AccountSnapshot }) {
  const primary = windowFor(account, /five|primary/i);
  const secondary = windowFor(account, /week|secondary/i);
  const actionRequired = account.connection === "action_required" || account.authentication === "unauthenticated";
  return (
    <article className="account-card">
      <h3>{account.id}</h3>
      <p>{account.connection.replaceAll("_", " ")}</p>
      <RateLimitBar label="Five-hour" window={primary} />
      <RateLimitBar label="Weekly" window={secondary} />
      {actionRequired ? <><p>Action required: sign in to this account.</p>{account.terminalCommand ? <code>{account.terminalCommand}</code> : null}</> : null}
    </article>
  );
}

function LaunchDialog({ preview, onClose, onLaunch }: { preview: LaunchPreview; onClose: () => void; onLaunch: () => Promise<void> }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => closeButton.current?.focus(), []);
  return (
    <div className="dialog-backdrop" onMouseDown={onClose}>
      <section className="launch-dialog" role="dialog" aria-modal="true" aria-labelledby="launch-dialog-title" onMouseDown={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === "Escape") onClose(); if (event.key === "Tab") { const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled])')]; const first = focusable[0]; const last = focusable.at(-1); if (!first || !last) return; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } } }}>
        <h2 id="launch-dialog-title">Launch {preview.task.id}</h2>
        <dl>
          <dt>Phase</dt><dd>{preview.task.readiness.phase.toUpperCase()}</dd>
          <dt>Dependencies</dt><dd>{preview.dependencies.length ? preview.dependencies.join(", ") : "None reported"}</dd>
          <dt>Account</dt><dd>{preview.accountId}</dd>
          <dt>Concurrency</dt><dd>{preview.concurrencyImpact}</dd>
        </dl>
        <pre>{preview.prompt}</pre>
        <div className="dialog-actions"><button ref={closeButton} type="button" onClick={onClose}>Close</button><button className="primary-button" type="button" onClick={() => void onLaunch()}>Launch</button></div>
      </section>
    </div>
  );
}

export function HomePage({ snapshot, api }: { snapshot: CoordinatorSnapshot; api: HomeApi }) {
  const [preview, setPreview] = useState<LaunchPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const launchTrigger = useRef<HTMLElement | null>(null);
  const ready = snapshot.tasks.filter((task) => task.readiness.state === "ready");
  const active = snapshot.dispatches.filter((dispatch) => isActiveDispatch(dispatch.state));
  const queued = snapshot.dispatches.filter((dispatch) => dispatch.state === "queued" || dispatch.state === "waiting_for_limit");
  const blockedAttention = snapshot.tasks.filter((task) => task.readiness.state === "blocked" || task.readiness.state === "attention_required").length + snapshot.pendingApprovals.length;

  const reviewLaunch = async (task: TaskNode) => {
    setError(null);
    try {
      const result = await api.previewLaunch(task.id);
      if ("error" in result && result.error) return setError(result.error.message);
      setPreview(result.data);
    } catch {
      setError("Unable to review this launch.");
    }
  };

  const launch = async () => {
    if (!preview) return;
    try {
      const result = await api.launch(preview.task.id, preview.accountId);
      if ("error" in result && result.error) return setError(result.error.message);
      setPreview(null);
      setMessage(`Launch submitted for ${preview.task.id}.`);
    } catch {
      setError("Unable to submit this launch.");
    }
  };

  const closePreview = () => setPreview(null);
  useEffect(() => {
    if (!preview) launchTrigger.current?.focus();
  }, [preview]);

  return (
    <section className="home-page" aria-labelledby="home-title">
      <header><p className="eyebrow">Operating cockpit</p><h1 id="home-title">Home</h1><p>{ngrokCopy(snapshot)}</p>{snapshot.ngrok.publicUrl ? <a href={snapshot.ngrok.publicUrl}>{snapshot.ngrok.publicUrl}</a> : null}</header>
      {message ? <p role="status">{message}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      <dl className="metric-grid">
        <div><dt>Active</dt><dd>{active.length}</dd></div><div><dt>Ready</dt><dd>{ready.length}</dd></div><div><dt>Queue</dt><dd>{queued.length}</dd></div><div><dt>Blocked / attention</dt><dd>{blockedAttention}</dd></div>
      </dl>
      <section aria-labelledby="active-work-title"><h2 id="active-work-title">Active work</h2>{active.length ? active.map((dispatch) => <ActiveWork key={dispatch.id} snapshot={snapshot} dispatchId={dispatch.id} />) : <p>No active work reported.</p>}</section>
      <section aria-labelledby="ready-title"><h2 id="ready-title">Next ready work</h2>{ready.length ? ready.map((task) => <article className="ready-task" key={task.id}><div><StatusBadge state={task.readiness.state} /><h3>{task.id} · {task.title}</h3><p>Suggested account: {task.readiness.suggestedAccount ?? "Unknown"}</p></div><button type="button" onClick={(event) => { launchTrigger.current = event.currentTarget; void reviewLaunch(task); }}>Review launch for {task.id}</button></article>) : <p>No launchable work reported.</p>}</section>
      <section aria-labelledby="accounts-title"><h2 id="accounts-title">Accounts</h2><div className="account-grid">{snapshot.accounts.map((account) => <AccountCard account={account} key={account.id} />)}</div></section>
      <section aria-labelledby="approvals-title"><h2 id="approvals-title">Attention queue</h2>{snapshot.pendingApprovals.length ? snapshot.pendingApprovals.map((approval) => <article key={approval.id}><p>{approval.summary}</p><small>{approval.accountId} · {approval.method}</small></article>) : <p>No pending approvals reported.</p>}</section>
      {preview ? <LaunchDialog preview={preview} onClose={closePreview} onLaunch={launch} /> : null}
    </section>
  );
}
