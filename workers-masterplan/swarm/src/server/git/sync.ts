import type { AccountId, GitSyncStatus } from "../../shared/contracts.js";

type GitSyncTarget = "local" | AccountId;
type GitAction = GitSyncStatus["action"];

export interface GitSynchronizerDependencies {
  pullLocal(): Promise<void | "skipped">;
  pushBot(account: AccountId): Promise<void | "skipped">;
  now?: () => number;
  everyMs?: number;
  schedule?: (operation: () => void, everyMs: number) => NodeJS.Timeout;
}

const botAccounts: AccountId[] = ["bot1", "bot2", "bot3", "bot4", "bot5", "bot6", "bot7", "bot8"];

function initial(action: GitAction): GitSyncStatus {
  return { state: "idle", action, lastAttemptAt: null };
}

/** Deterministic hourly local-pull then bot-push maintenance; failures wait for the next interval. */
export class GitSynchronizer {
  private readonly now: () => number;
  private readonly statuses = new Map<GitSyncTarget, GitSyncStatus>([["local", initial("pull")], ...botAccounts.map((account) => [account, initial("push")] as const)]);
  private readonly listeners = new Set<(target: GitSyncTarget, status: GitSyncStatus) => void>();
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly dependencies: GitSynchronizerDependencies) {
    this.now = dependencies.now ?? Date.now;
  }

  onChange(listener: (target: GitSyncTarget, status: GitSyncStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  snapshot(target: GitSyncTarget): GitSyncStatus {
    const value = this.statuses.get(target);
    if (!value) throw new Error("Unknown Git synchronization target");
    return { ...value };
  }

  async syncNow(): Promise<void> {
    await this.run("local", "pull", () => this.dependencies.pullLocal());
    for (const account of botAccounts) await this.run(account, "push", () => this.dependencies.pushBot(account));
  }

  start(): void {
    if (this.timer) return;
    void this.syncNow();
    this.timer = (this.dependencies.schedule ?? setInterval)(() => { void this.syncNow(); }, this.dependencies.everyMs ?? 60 * 60_000);
    this.timer.unref();
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  private async run(target: GitSyncTarget, action: GitAction, operation: () => Promise<void | "skipped">): Promise<void> {
    const lastAttemptAt = this.now();
    try {
      if (await operation() === "skipped") return;
      this.publish(target, { state: "ok", action, lastAttemptAt });
    } catch {
      this.publish(target, { state: "warning", action, lastAttemptAt, message: `Git ${action} failed.` });
    }
  }

  private publish(target: GitSyncTarget, status: GitSyncStatus): void {
    this.statuses.set(target, status);
    for (const listener of this.listeners) listener(target, { ...status });
  }
}
