import { BOT_ACCOUNT_IDS, type BotAccountId, type GitSyncStatus } from "../../shared/contracts.js";

type GitSyncTarget = "local" | BotAccountId;
type GitAction = GitSyncStatus["action"];

export interface GitSynchronizerDependencies {
  pullLocal(): Promise<void | "skipped">;
  pullBot(account: BotAccountId): Promise<void | "skipped">;
  now?: () => number;
  everyMs?: number;
  schedule?: (operation: () => void, everyMs: number) => NodeJS.Timeout;
}

const botAccounts = BOT_ACCOUNT_IDS;

export class GitMergeConflictError extends Error {
  constructor() {
    super("Git pull produced merge conflicts");
    this.name = "GitMergeConflictError";
  }
}

/** Suppresses repeated LLM steering while the same unresolved conflict remains. */
export class MergeConflictSteerGate {
  private readonly notified = new Set<BotAccountId>();

  shouldSteer(target: BotAccountId, status: GitSyncStatus): boolean {
    if (status.errorCode !== "MERGE_CONFLICT") {
      this.notified.delete(target);
      return false;
    }
    if (this.notified.has(target)) return false;
    this.notified.add(target);
    return true;
  }
}

function initial(action: GitAction): GitSyncStatus {
  return { state: "idle", action, lastAttemptAt: null };
}

/** Deterministic one-minute origin pull for every macOS profile; failures wait for the next interval. */
export class GitSynchronizer {
  private readonly now: () => number;
  private readonly statuses = new Map<GitSyncTarget, GitSyncStatus>([["local", initial("pull")], ...botAccounts.map((account) => [account, initial("pull")] as const)]);
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
    for (const account of botAccounts) await this.run(account, "pull", () => this.dependencies.pullBot(account));
  }

  start(): void {
    if (this.timer) return;
    void this.syncNow();
    this.timer = (this.dependencies.schedule ?? setInterval)(() => { void this.syncNow(); }, this.dependencies.everyMs ?? 60_000);
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
    } catch (error) {
      this.publish(target, {
        state: "warning",
        action,
        lastAttemptAt,
        message: error instanceof GitMergeConflictError ? "Git pull has merge conflicts." : `Git ${action} failed.`,
        ...(error instanceof GitMergeConflictError ? { errorCode: "MERGE_CONFLICT" as const } : {}),
      });
    }
  }

  private publish(target: GitSyncTarget, status: GitSyncStatus): void {
    this.statuses.set(target, status);
    for (const listener of this.listeners) listener(target, { ...status });
  }
}
