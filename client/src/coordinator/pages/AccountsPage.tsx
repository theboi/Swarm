import { AccountCard } from "../components/AccountCard";
import { useEdenModal } from "@/components/overlay/EdenOverlayProvider/useEdenModal";
import { EdenButton } from "@/components/primitives/EdenButton/EdenButton";
import { EdenIcon } from "@/components/primitives/EdenIcon/EdenIcon";
import { useEffect, useRef, useState } from "react";

import { isBotProfileAccountId, type AccountSnapshot, type BotProfileAccountId, type CoordinatorSnapshot, type MacosBotId } from "../../shared/contracts.js";
import type { CoordinatorApi, ProfileLoginResponse } from "../api.js";
import { ProfileLoginDialog } from "../components/ProfileLoginDialog.js";
import { Toast } from "../components/Toast.js";

type AccountsApi = Pick<CoordinatorApi, "addAccount" | "cancelAccountLogin" | "connectAccount" | "makePrimary" | "openTerminal" | "refreshAllRateLimits" | "startAccountLogin">;
type LoginDialogState = { accountId: BotProfileAccountId; challenge: ProfileLoginResponse };

function profileError(code: string | undefined, fallback: string): string {
  if (code === "DESKTOP_APP_RUNNING") return "Close ChatGPT or Codex Desktop for this bot, then try again.";
  if (code === "PROFILE_AUTH_ISOLATION_UNAVAILABLE") return "This profile cannot use an isolated credential store on this Mac.";
  if (code === "LOGIN_EXPIRED") return "This sign-in code expired. Select Retry to start a new one.";
  if (code === "IDENTITY_ALREADY_CONNECTED") return "That ChatGPT identity is already connected to another profile.";
  if (code === "DEVICE_AUTH_UNAVAILABLE") return "Device sign-in is unavailable. Use browser sign-in or open a terminal.";
  return fallback;
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
  const [loginPending, setLoginPending] = useState(false);
  const loginTrigger = useRef<HTMLButtonElement | null>(null);
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
    loginTrigger.current = trigger;
    if (account.authentication === "unauthenticated" && isBotProfileAccountId(account.id)) {
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
  const card = (account: AccountSnapshot, headingLevel: 2 | 3) => <AccountCard authenticationError={profileError(account.errorCode, "Action required: sign in to this account.")} account={account} assignments={(snapshot.workerAssignments ?? []).filter((assignment) => assignment.accountId === account.id && (assignment.state === "assigned" || assignment.state === "waiting_for_limit"))} tasks={snapshot.tasks} headingLevel={headingLevel} key={account.id} onOpenTerminal={openTerminal} onReconnect={reconnect} onMakePrimary={(id) => void makePrimary(id)} primaryPending={primaryPending !== null} />;


  const closeLogin = () => {
    setLogin(null);
    window.setTimeout(() => loginTrigger.current?.focus(), 0);
  };
  const loginModal = useEdenModal({
    title: login ? `Sign in to ${login.accountId}` : "Sign in",
    open: Boolean(login), dismissible: !loginPending,
    onClose: () => {
      if (login) void api.cancelAccountLogin(login.accountId).catch(() => undefined);
      closeLogin();
    },
    content: login ? <ProfileLoginDialog accountId={login.accountId} challenge={login.challenge} onStart={api.startAccountLogin} onCancel={api.cancelAccountLogin} onClose={closeLogin} onPendingChange={setLoginPending} /> : null,
  });
  return <section className="accounts-page" aria-label="Accounts">
    <header className="accounts-page__header"><div><p className="eyebrow">Account capacity</p><h1 id="accounts-page-title">Accounts</h1><p>Usage limits, connection status, and account actions.</p></div><div className="accounts-page__actions"><EdenButton density="compact" appearance="secondary" isFloating={false} className="icon-button" type="button" aria-label="Refresh usage" title="Refresh usage" onClick={() => void refreshUsage()}><EdenIcon name="rotateCw" aria-hidden="true" size={16} /></EdenButton><EdenButton density="compact" appearance="secondary" isFloating={false} className="icon-button" type="button" aria-label="Back to home" title="Back to home" onClick={onBack}><EdenIcon name="arrowLeft" aria-hidden="true" size={18} /></EdenButton></div></header>
    {message ? <Toast onDismiss={() => setMessage(null)}>{message}</Toast> : null}
    {error ? <Toast tone="error" onDismiss={() => setError(null)}>{error}</Toast> : null}
    <div className="accounts-list">
      {otherAccounts.map((account) => card(account, 2))}
      {profileGroups.map(({ bot, accounts: botAccounts }) => <section className="account-bot-group" aria-label={bot} key={bot}>
        <header className="account-bot-group__header"><div><p className="eyebrow">Bot profiles</p><h2 id={`account-bot-${bot}`}>{bot}</h2></div><EdenButton density="compact" appearance="secondary" isFloating={false} className="account-card__action" type="button" disabled={addingBot !== null} onClick={(event) => void addAccount(bot, event.currentTarget)}>{addingBot === bot ? "Adding account…" : `Add account for ${bot}`}</EdenButton></header>
        <div className="account-bot-group__cards">{botAccounts.map((account) => card(account, 3))}</div>
      </section>)}
    </div>
    {loginModal.modal}
  </section>;
}
