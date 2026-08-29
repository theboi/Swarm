import { ChevronRight, CircleCheck, RotateCw, TriangleAlert } from "lucide-react";

import type { AccountSnapshot, RateLimitWindow, TaskNode, WorkerAssignmentRecord } from "../../shared/contracts.js";

function windowFor(account: AccountSnapshot, pattern: RegExp): RateLimitWindow | undefined {
  return account.rateLimits.find((window) => pattern.test(window.label) || pattern.test(window.id));
}

function remainingPercent(window: RateLimitWindow | undefined): number | null {
  return typeof window?.usedPercent === "number" ? Math.max(0, Math.min(100, 100 - window.usedPercent)) : null;
}

function displayPercent(value: number | null): string {
  return value === null ? "unknown" : `${value}%`;
}

function usageWidth(value: number | null): string {
  return `${value ?? 0}%`;
}

export function AccountSummaryPanel({ accounts, assignments = [], tasks = [], onOpenAccountChat, onViewMore, onRefreshUsage }: { accounts: AccountSnapshot[]; assignments?: WorkerAssignmentRecord[]; tasks?: TaskNode[]; onOpenAccountChat?: (accountId: AccountSnapshot["id"]) => void; onViewMore: () => void; onRefreshUsage?: () => Promise<void> }) {
  return (
    <aside className="home-accounts-sidebar account-summary-card" aria-labelledby="accounts-title">
      <header className="account-summary__header"><h2 id="accounts-title">Accounts</h2><div>{onRefreshUsage ? <button className="icon-button" type="button" aria-label="Refresh usage" title="Refresh usage" onClick={() => void onRefreshUsage()}><RotateCw aria-hidden="true" size={16} /></button> : null}<button className="icon-button" type="button" aria-label="View more accounts" title="View more accounts" onClick={onViewMore}><ChevronRight aria-hidden="true" size={18} /></button></div></header>
      <ul className="account-summary-list">
        {accounts.map((account) => {
          const fiveHour = remainingPercent(windowFor(account, /five|primary/i));
          const weekly = remainingPercent(windowFor(account, /week|secondary/i));
          const fiveHourText = displayPercent(fiveHour);
          const weeklyText = displayPercent(weekly);
          const isConnected = account.connection === "connected" && account.authentication === "authenticated";
          const currentWork = assignments.filter((assignment) => assignment.accountId === account.id && (assignment.state === "assigned" || assignment.state === "waiting_for_limit"));
          return <li className="account-summary-row" key={account.id}>
            <button className="account-summary-row__button" type="button" onClick={() => onOpenAccountChat?.(account.id)} aria-label={`Open chats for ${account.id}`}>
              <div className="account-summary-row__header"><div className="account-summary-row__identity"><h3>{account.id}</h3>{account.hasBreakingChange ? <span className="account-notification-dot" role="img" aria-label={`${account.id} has a breaking change notification`} title="Breaking change notification" /> : null}<span className={`account-summary-status account-summary-status--${isConnected ? "connected" : "warning"}`} role="img" aria-label={`${account.id} ${isConnected ? "connected" : "requires attention"}`} title={isConnected ? "Connected" : "Requires attention"}>{isConnected ? <CircleCheck aria-hidden="true" size={16} /> : <TriangleAlert aria-hidden="true" size={16} />}</span></div><p className="account-summary-row__limits"><span>5h {fiveHourText}</span><span>Week {weeklyText}</span></p></div>
              <div className="account-summary__usage" role="img" aria-label={`${account.id}: five-hour remaining ${fiveHourText}; weekly remaining ${weeklyText}`}>
                <span className="account-summary__weekly" aria-hidden="true" style={{ width: usageWidth(weekly) }} />
                <span className="account-summary__five-hour" aria-hidden="true" style={{ width: usageWidth(fiveHour) }} />
              </div>
              {currentWork.length ? <p className="account-summary-row__work">{currentWork.map((assignment) => { const task = tasks.find((candidate) => candidate.id === assignment.taskId); return `${assignment.taskId}${task ? ` · ${task.title}` : ""}${assignment.state === "waiting_for_limit" ? " · waiting for limit" : ""}`; }).join(", ")}</p> : null}
            </button>
          </li>;
        })}
      </ul>
    </aside>
  );
}
