import { ArrowLeft, RotateCw } from "lucide-react";
import { useState } from "react";

import type { AccountSnapshot, CoordinatorSnapshot, GitSyncStatus, RateLimitWindow, TaskNode, WorkerAssignmentRecord } from "../../shared/contracts.js";
import type { CoordinatorApi } from "../api.js";
import { RateLimitBar } from "../components/RateLimitBar.js";
import { Toast } from "../components/Toast.js";
import { remainingPercent } from "../usage.js";

type AccountsApi = Pick<CoordinatorApi, "connectAccount" | "openTerminal" | "refreshAllRateLimits">;

function windowFor(account: AccountSnapshot, pattern: RegExp): RateLimitWindow | undefined {
  return account.rateLimits.find((window) => pattern.test(window.label) || pattern.test(window.id));
}

function isActionRequired(account: AccountSnapshot): boolean {
  return account.connection === "action_required" || account.authentication === "unauthenticated";
}

function GitSyncWarning({ status }: { status: GitSyncStatus | undefined }) {
  if (status?.state !== "warning") return null;
  return <span role="img" aria-label={`Git ${status.action} warning`} title={status.message ?? `Git ${status.action} failed.`}>⚠</span>;
}

function AccountCard({ account, assignments, tasks, onOpenTerminal, onReconnect }: { account: AccountSnapshot; assignments: WorkerAssignmentRecord[]; tasks: TaskNode[]; onOpenTerminal: (account: AccountSnapshot) => void; onReconnect: (account: AccountSnapshot) => void }) {
  const primary = windowFor(account, /five|primary/i);
  const secondary = windowFor(account, /week|secondary/i);
  const actionRequired = isActionRequired(account);
  const weeklyExhausted = remainingPercent(secondary) === 0;
  return (
    <article className="account-card">
      <h2>{account.id} {account.hasBreakingChange ? <span className="account-notification-dot" role="img" aria-label={`${account.id} has a breaking change notification`} title="Breaking change notification" /> : null} <GitSyncWarning status={account.gitSync} /></h2>
      <p>{account.connection.replaceAll("_", " ")}</p>
      <RateLimitBar label="Five-hour" window={primary} forceEmpty={weeklyExhausted} />
      <RateLimitBar label="Weekly" window={secondary} />
      {assignments.length ? <div className="account-card__work"><strong>Current work</strong>{assignments.map((assignment) => <p key={assignment.taskId}>{assignment.taskId} · {tasks.find((task) => task.id === assignment.taskId)?.title ?? "Worker task"}{assignment.state === "waiting_for_limit" ? " · waiting for limit" : ""}</p>)}</div> : <p>No assigned worker tasks.</p>}
      {actionRequired ? <><p>Action required: sign in to this account.</p>{account.terminalCommand ? <code>{account.terminalCommand}</code> : null}</> : null}
      <div className="account-card__actions"><button className="account-card__action" type="button" onClick={() => onOpenTerminal(account)}>Open terminal for {account.id}</button>{actionRequired ? <button className="account-card__action" type="button" onClick={() => onReconnect(account)}>Reconnect {account.id}</button> : null}</div>
    </article>
  );
}

export function AccountsPage({ snapshot, api, onRefresh, onRefreshUsage, onBack }: { snapshot: CoordinatorSnapshot; api: AccountsApi; onRefresh: () => Promise<void>; onRefreshUsage?: () => Promise<void>; onBack: () => void }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const openTerminal = async (account: AccountSnapshot) => {
    setError(null);
    try {
      const result = await api.openTerminal(account.id);
      if ("error" in result && result.error) return setError(result.error.message);
      setMessage(account.connection === "connected" ? `Terminal opened for ${account.id}.` : `Sign-in terminal opened for ${account.id}.`);
    } catch {
      setError(`Unable to open a terminal for ${account.id}.`);
    }
  };
  const reconnect = async (account: AccountSnapshot) => {
    setError(null);
    try {
      const result = await api.connectAccount(account.id);
      if ("error" in result && result.error) return setError(result.error.message);
      setMessage(`Account ${account.id} reconnected.`);
      await onRefresh().catch(() => undefined);
    } catch {
      setError(`Unable to reconnect ${account.id}.`);
    }
  };
  const refreshUsage = async () => {
    setError(null);
    try {
      if (onRefreshUsage) await onRefreshUsage();
      else {
        const result = await api.refreshAllRateLimits();
        if ("error" in result && result.error) throw new Error(result.error.message);
        await onRefresh();
      }
      setMessage("Account usage refreshed.");
    } catch {
      setError("Unable to refresh account usage.");
    }
  };
  return (
    <section className="accounts-page" aria-labelledby="accounts-page-title">
      <header className="accounts-page__header"><div><p className="eyebrow">Account capacity</p><h1 id="accounts-page-title">Accounts</h1><p>Usage limits, connection status, and account actions.</p></div><div className="accounts-page__actions"><button className="icon-button" type="button" aria-label="Refresh usage" title="Refresh usage" onClick={() => void refreshUsage()}><RotateCw aria-hidden="true" size={16} /></button><button className="icon-button" type="button" aria-label="Back to home" title="Back to home" onClick={onBack}><ArrowLeft aria-hidden="true" size={18} /></button></div></header>
      {message ? <Toast onDismiss={() => setMessage(null)}>{message}</Toast> : null}
      {error ? <Toast tone="error" onDismiss={() => setError(null)}>{error}</Toast> : null}
      <div className="accounts-grid">{snapshot.accounts.map((account) => <AccountCard account={account} assignments={(snapshot.workerAssignments ?? []).filter((assignment) => assignment.accountId === account.id && (assignment.state === "assigned" || assignment.state === "waiting_for_limit"))} tasks={snapshot.tasks} key={account.id} onOpenTerminal={openTerminal} onReconnect={reconnect} />)}</div>
    </section>
  );
}
