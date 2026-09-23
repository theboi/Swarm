import { ArrowLeft, RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { isBotProfileAccountId, type AccountSnapshot, type BotProfileAccountId, type CoordinatorSnapshot, type GitSyncStatus, type MacosBotId, type RateLimitWindow, type TaskNode, type WorkerAssignmentRecord } from "../../shared/contracts.js";
import type { CoordinatorApi, ProfileLoginResponse } from "../api.js";
import { ProfileLoginDialog } from "../components/ProfileLoginDialog.js";
import { RateLimitBar } from "../components/RateLimitBar.js";
import { Toast } from "../components/Toast.js";
import { remainingPercent } from "../usage.js";

type AccountsApi = Pick<CoordinatorApi, "addAccount" | "cancelAccountLogin" | "connectAccount" | "makePrimary" | "openTerminal" | "refreshAllRateLimits" | "startAccountLogin">;
type LoginDialogState = { accountId: BotProfileAccountId; challenge: ProfileLoginResponse };

function windowFor(account: AccountSnapshot, pattern: RegExp): RateLimitWindow | undefined {
  return account.rateLimits.find((window) => pattern.test(window.label) || pattern.test(window.id));
}

function isActionRequired(account: AccountSnapshot): boolean {
  return account.connection === "action_required" || account.authentication === "unauthenticated";
}

function profileError(code: string | undefined, fallback: string): string {
  if (code === "DESKTOP_APP_RUNNING") return "Close ChatGPT or Codex Desktop for this bot, then try again.";
  if (code === "PROFILE_AUTH_ISOLATION_UNAVAILABLE") return "This profile cannot use an isolated credential store on this Mac.";
  if (code === "LOGIN_EXPIRED") return "This sign-in code expired. Select Retry to start a new one.";
  if (code === "IDENTITY_ALREADY_CONNECTED") return "That ChatGPT identity is already connected to another profile.";
  if (code === "DEVICE_AUTH_UNAVAILABLE") return "Device sign-in is unavailable. Use browser sign-in or open a terminal.";
  return fallback;
}

function GitSyncWarning({ status }: { status: GitSyncStatus | undefined }) {
  if (status?.state !== "warning") return null;
  return <span role="img" aria-label={`Git ${status.action} warning`} title={status.message ?? `Git ${status.action} failed.`}>⚠</span>;
}

function AccountCard({ account, assignments, tasks, headingLevel, onOpenTerminal, onReconnect, onMakePrimary, primaryPending }: {
  account: AccountSnapshot;
  assignments: WorkerAssignmentRecord[];
  tasks: TaskNode[];
  headingLevel: 2 | 3;
  onOpenTerminal: (account: AccountSnapshot) => void;
  onReconnect: (account: AccountSnapshot, trigger: HTMLButtonElement) => void;
  onMakePrimary: (account: BotProfileAccountId) => void;
  primaryPending: boolean;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const primary = windowFor(account, /five|primary/i);
  const secondary = windowFor(account, /week|secondary/i);
  const actionRequired = isActionRequired(account);
  const weeklyExhausted = remainingPercent(secondary) === 0;
  const profileAccount = isBotProfileAccountId(account.id) ? account.id : undefined;
  return <article className="account-card">
    <header className="account-card__header"><Heading>{account.id} {account.hasBreakingChange ? <span className="account-notification-dot" role="img" aria-label={`${account.id} has a breaking change notification`} title="Breaking change notification" /> : null} <GitSyncWarning status={account.gitSync} /></Heading>{profileAccount && account.isPrimary ? <span className="account-primary-status">Primary</span> : null}</header>
    <p>{account.connection.replaceAll("_", " ")}</p>
    {account.identityDisplay?.email ? <p className="account-card__identity">Signed in as {account.identityDisplay.email}</p> : null}
    <RateLimitBar label="Five-hour" window={primary} forceEmpty={weeklyExhausted} />
    <RateLimitBar label="Weekly" window={secondary} />
    {assignments.length ? <div className="account-card__work"><strong>Current work</strong>{assignments.map((assignment) => <p key={assignment.taskId}>{assignment.taskId} · {tasks.find((task) => task.id === assignment.taskId)?.title ?? "Worker task"}{assignment.state === "waiting_for_limit" ? " · waiting for limit" : ""}</p>)}</div> : <p>No assigned worker tasks.</p>}
    {actionRequired ? <><p role="alert">{profileError(account.errorCode, "Action required: sign in to this account.")}</p>{account.terminalCommand ? <code>{account.terminalCommand}</code> : null}</> : null}
    <div className="account-card__actions">
      <button className="account-card__action" type="button" onClick={() => onOpenTerminal(account)}>Open terminal for {account.id}</button>
      {actionRequired ? <button className="account-card__action" type="button" onClick={(event) => onReconnect(account, event.currentTarget)}>{profileAccount && account.authentication === "unauthenticated" ? `Login to ${account.id}` : `Reconnect ${account.id}`}</button> : null}
      {profileAccount && !account.isPrimary ? <button className="account-card__action account-card__make-primary" type="button" disabled={primaryPending} onClick={() => onMakePrimary(profileAccount)}>{primaryPending ? "Making primary…" : `Make Primary for ${account.id}`}</button> : null}
    </div>
  </article>;
}

function byProfileOrder(left: AccountSnapshot, right: AccountSnapshot): number {
  return (left.accountNumber ?? Number(left.id.split("/acc")[1] ?? 0)) - (right.accountNumber ?? Number(right.id.split("/acc")[1] ?? 0));
}

export function AccountsPage({ snapshot, api, onRefresh, onRefreshUsage, onBack }: { snapshot: CoordinatorSnapshot; api: AccountsApi; onRefresh: () => Promise<void>; onRefreshUsage?: () => Promise<void>; onBack: () => void }) {
  const [accounts, setAccounts] = useState(snapshot.accounts);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [primaryPending, setPrimaryPending] = useState<BotProfileAccountId | null>(null);
  const [addingBot, setAddingBot] = useState<MacosBotId | null>(null);
  const [login, setLogin] = useState<LoginDialogState | null>(null);
  const loginTrigger = useRef<HTMLElement | null>(null);
  useEffect(() => setAccounts(snapshot.accounts), [snapshot.accounts]);

  const mergeAccounts = (next: AccountSnapshot[]) => setAccounts((current) => {
    const byId = new Map(next.map((account) => [account.id, account]));
    return [...current.map((account) => byId.get(account.id) ?? account), ...next.filter((account) => !current.some((candidate) => candidate.id === account.id))];
  });
  const openTerminal = async (account: AccountSnapshot) => {
    setError(null);
    try {
      const result = await api.openTerminal(account.id);
      if ("error" in result && result.error) return setError(result.error.message);
      setMessage(account.connection === "connected" ? `Terminal opened for ${account.id}.` : `Sign-in terminal opened for ${account.id}.`);
    } catch { setError(`Unable to open a terminal for ${account.id}.`); }
  };
  const reconnect = async (account: AccountSnapshot, trigger: HTMLButtonElement) => {
    setError(null);
    if (account.authentication === "unauthenticated" && isBotProfileAccountId(account.id)) {
      loginTrigger.current = trigger;
      try {
        const started = await api.startAccountLogin(account.id, "device_code");
        if ("error" in started && started.error) { setError(profileError(started.error.code, started.error.message)); return; }
        setLogin({ accountId: account.id, challenge: started.data });
        setMessage(`${account.id} is ready to sign in.`);
      } catch { setError(`Unable to start sign-in for ${account.id}.`); }
      return;
    }
    try {
      const result = await api.connectAccount(account.id);
      if ("error" in result && result.error) return setError(result.error.message);
      setMessage(`Account ${account.id} reconnected.`);
      await onRefresh().catch(() => undefined);
    } catch { setError(`Unable to reconnect ${account.id}.`); }
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
    } catch { setError("Unable to refresh account usage."); }
  };
  const makePrimary = async (accountId: BotProfileAccountId) => {
    setPrimaryPending(accountId);
    setError(null);
    try {
      const result = await api.makePrimary(accountId);
      if ("error" in result && result.error) { setError(profileError(result.error.code, result.error.message)); return; }
      mergeAccounts(result.data);
      setMessage(`${accountId} is now the primary profile.`);
      await onRefresh().catch(() => undefined);
    } catch { setError("Unable to make this profile primary."); }
    finally { setPrimaryPending(null); }
  };
  const addAccount = async (bot: MacosBotId, trigger: HTMLButtonElement) => {
    loginTrigger.current = trigger;
    setAddingBot(bot);
    setError(null);
    try {
      const added = await api.addAccount(bot);
      if ("error" in added && added.error) { setError(profileError(added.error.code, added.error.message)); return; }
      if (!isBotProfileAccountId(added.data.id)) { setError("Unable to create a valid profile account."); return; }
      mergeAccounts([added.data]);
      const started = await api.startAccountLogin(added.data.id, "device_code");
      if ("error" in started && started.error) { setError(profileError(started.error.code, started.error.message)); return; }
      setLogin({ accountId: added.data.id, challenge: started.data });
      setMessage(`${added.data.id} is ready to sign in.`);
      await onRefresh().catch(() => undefined);
    } catch { setError("Unable to add an account. Try again."); }
    finally { setAddingBot(null); }
  };
  const profileGroups = [...new Set(accounts.flatMap((account) => account.macosUser ? [account.macosUser] : []))].sort((left, right) => Number(left.slice(3)) - Number(right.slice(3))).map((bot) => ({ bot, accounts: accounts.filter((account) => account.macosUser === bot).sort(byProfileOrder) }));
  const otherAccounts = accounts.filter((account) => !account.macosUser);
  const card = (account: AccountSnapshot, headingLevel: 2 | 3) => <AccountCard account={account} assignments={(snapshot.workerAssignments ?? []).filter((assignment) => assignment.accountId === account.id && (assignment.state === "assigned" || assignment.state === "waiting_for_limit"))} tasks={snapshot.tasks} headingLevel={headingLevel} key={account.id} onOpenTerminal={openTerminal} onReconnect={reconnect} onMakePrimary={(id) => void makePrimary(id)} primaryPending={primaryPending !== null} />;

  return <section className="accounts-page" aria-labelledby="accounts-page-title">
    <header className="accounts-page__header"><div><p className="eyebrow">Account capacity</p><h1 id="accounts-page-title">Accounts</h1><p>Usage limits, connection status, and account actions.</p></div><div className="accounts-page__actions"><button className="icon-button" type="button" aria-label="Refresh usage" title="Refresh usage" onClick={() => void refreshUsage()}><RotateCw aria-hidden="true" size={16} /></button><button className="icon-button" type="button" aria-label="Back to home" title="Back to home" onClick={onBack}><ArrowLeft aria-hidden="true" size={18} /></button></div></header>
    {message ? <Toast onDismiss={() => setMessage(null)}>{message}</Toast> : null}
    {error ? <Toast tone="error" onDismiss={() => setError(null)}>{error}</Toast> : null}
    <div className="accounts-list">
      {otherAccounts.map((account) => card(account, 2))}
      {profileGroups.map(({ bot, accounts: botAccounts }) => <section className="account-bot-group" aria-labelledby={`account-bot-${bot}`} key={bot}>
        <header className="account-bot-group__header"><div><p className="eyebrow">Bot profiles</p><h2 id={`account-bot-${bot}`}>{bot}</h2></div><button className="account-card__action" type="button" disabled={addingBot !== null} onClick={(event) => void addAccount(bot, event.currentTarget)}>{addingBot === bot ? "Adding account…" : `Add account for ${bot}`}</button></header>
        <div className="account-bot-group__cards">{botAccounts.map((account) => card(account, 3))}</div>
      </section>)}
    </div>
    {login ? <ProfileLoginDialog accountId={login.accountId} challenge={login.challenge} onStart={api.startAccountLogin} onCancel={api.cancelAccountLogin} onClose={() => setLogin(null)} onRestoreFocus={() => window.setTimeout(() => loginTrigger.current?.focus(), 0)} /> : null}
  </section>;
}
