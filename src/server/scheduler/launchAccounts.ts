import { LOCAL_ACCOUNT_ID, type AccountSnapshot, type LaunchAccountOption, type ThreadSummary } from "../../shared/contracts.js";

/** Ranks selectable accounts by the same unarchived-chat count displayed on the Chats page. */
export function rankLaunchAccounts(accounts: AccountSnapshot[], threads: ThreadSummary[]): LaunchAccountOption[] {
  const activeWorkers = new Map<string, number>(accounts.map((account) => [account.id, 0] as const));
  for (const thread of threads) {
    if (!thread.archived) activeWorkers.set(thread.accountId, (activeWorkers.get(thread.accountId) ?? 0) + 1);
  }
  return accounts.map((account) => ({
    id: account.id,
    activeWorkers: activeWorkers.get(account.id) ?? 0,
    available: account.connection === "connected" && account.authentication === "authenticated",
  })).sort((left, right) => Number(right.available) - Number(left.available)
    || left.activeWorkers - right.activeWorkers
    || Number(right.id === LOCAL_ACCOUNT_ID) - Number(left.id === LOCAL_ACCOUNT_ID)
    || left.id.localeCompare(right.id));
}
