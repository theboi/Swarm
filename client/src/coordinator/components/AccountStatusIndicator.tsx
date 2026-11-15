import type { AccountSnapshot } from "../../shared/contracts.js";

export function AccountStatusIndicator({ account, working = false, waitingForLimit = false }: { account: AccountSnapshot; working?: boolean; waitingForLimit?: boolean }) {
  const connected = account.connection === "connected" && account.authentication === "authenticated";
  const label = waitingForLimit ? `${account.id} waiting for limit` : working ? `${account.id} working` : `${account.id} ${connected ? "connected" : "requires attention"}`;
  const activityClass = waitingForLimit ? "chat-account-picker__activity chat-account-picker__activity--limit" : working ? "chat-account-picker__activity" : "";
  const statusClass = connected ? "connected" : account.connection === "connecting" ? "connecting" : "error";
  return <span className={`account-status-indicator ${activityClass}`.trim()} role="img" aria-label={label} title={label}>
    <span className={`chat-account-picker__status chat-account-picker__status--${statusClass}`} aria-hidden="true" />
  </span>;
}
