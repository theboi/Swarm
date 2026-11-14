import { EdenButton } from "@/components/primitives/EdenButton/EdenButton";
import { EdenCard } from "@/components/primitives/EdenCard";
import { isBotProfileAccountId, type AccountSnapshot, type BotProfileAccountId, type GitSyncStatus, type RateLimitWindow, type TaskNode, type WorkerAssignmentRecord } from "../../../shared/contracts.js";
import { RateLimitBar } from "../RateLimitBar.js";
import { remainingPercent } from "../../usage.js";

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

export function AccountCard({ account, assignments, tasks, headingLevel, onOpenTerminal, onReconnect, onMakePrimary, primaryPending, authenticationError }: {
  account: AccountSnapshot;
  assignments: WorkerAssignmentRecord[];
  tasks: TaskNode[];
  headingLevel: 2 | 3;
  onOpenTerminal: (account: AccountSnapshot) => void;
  onReconnect: (account: AccountSnapshot, trigger: HTMLButtonElement) => void;
  onMakePrimary: (account: BotProfileAccountId) => void;
  primaryPending: boolean;
  authenticationError: string;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const primary = windowFor(account, /five|primary/i);
  const secondary = windowFor(account, /week|secondary/i);
  const actionRequired = isActionRequired(account);
  const weeklyExhausted = remainingPercent(secondary) === 0;
  const profileAccount = isBotProfileAccountId(account.id) ? account.id : undefined;
  return <EdenCard asChild><article className="account-card">
    <header className="account-card__header"><Heading>{account.id} {account.hasBreakingChange ? <span className="account-notification-dot" role="img" aria-label={`${account.id} has a breaking change notification`} title="Breaking change notification" /> : null} <GitSyncWarning status={account.gitSync} /></Heading>{profileAccount && account.isPrimary ? <span className="account-primary-status">Primary</span> : null}</header>
    <p>{account.connection.replaceAll("_", " ")}</p>
    {account.identityDisplay?.email ? <p className="account-card__identity">Signed in as {account.identityDisplay.email}</p> : null}
    <RateLimitBar label="Five-hour" window={primary} forceEmpty={weeklyExhausted} />
    <RateLimitBar label="Weekly" window={secondary} />
    {assignments.length ? <div className="account-card__work"><strong>Current work</strong>{assignments.map((assignment) => <p key={assignment.taskId}>{assignment.taskId} · {tasks.find((task) => task.id === assignment.taskId)?.title ?? "Worker task"}{assignment.state === "waiting_for_limit" ? " · waiting for limit" : ""}</p>)}</div> : <p>No assigned worker tasks.</p>}
    {actionRequired ? <><p role="alert">{authenticationError}</p>{account.terminalCommand ? <code>{account.terminalCommand}</code> : null}</> : null}
    <div className="account-card__actions">
      <EdenButton density="compact" appearance="secondary" isFloating={false} className="account-card__action" type="button" onClick={() => onOpenTerminal(account)}>Open terminal for {account.id}</EdenButton>
      {actionRequired ? <EdenButton density="compact" appearance="secondary" isFloating={false} className="account-card__action" type="button" onClick={(event) => onReconnect(account, event.currentTarget)}>{profileAccount && account.authentication === "unauthenticated" ? `Login to ${account.id}` : `Reconnect ${account.id}`}</EdenButton> : null}
      {profileAccount && !account.isPrimary ? <EdenButton density="compact" appearance="secondary" isFloating={false} className="account-card__action account-card__make-primary" type="button" disabled={primaryPending} onClick={() => onMakePrimary(profileAccount)}>{primaryPending ? "Making primary…" : `Make Primary for ${account.id}`}</EdenButton> : null}
    </div>
  </article></EdenCard>;
}
