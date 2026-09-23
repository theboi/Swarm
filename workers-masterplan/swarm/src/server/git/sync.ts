import { BOT_ACCOUNT_IDS, LOCAL_ACCOUNT_ID, type AccountId, type BotAccountId, type BotProfileAccountId, type CodexAccountSlot, type GitSyncStatus } from "../../shared/contracts.js";

export type GitSyncTarget = "local" | BotAccountId | BotProfileAccountId;
type GitAction = GitSyncStatus["action"];

export interface GitSynchronizerDependencies {
  pullLocal(): Promise<void | "skipped">;
  pullBot(account: BotAccountId | CodexAccountSlot): Promise<void | "skipped">;
  /** The current immutable profile registry. Omit only for legacy physical-bot deployments. */
  profileSlots?(): readonly CodexAccountSlot[];
  now?: () => number;
  everyMs?: number;
  schedule?: (operation: () => void, everyMs: number) => NodeJS.Timeout;
}

export class GitMergeConflictError extends Error {
  constructor() {
    super("Git pull produced merge conflicts");
    this.name = "GitMergeConflictError";
  }
}

/** Suppresses repeated LLM steering while the same unresolved conflict remains. */
export class MergeConflictSteerGate {
  private readonly notified = new Set<AccountId>();

  shouldSteer(target: AccountId, status: GitSyncStatus): boolean {
    if (status.errorCode !== "MERGE_CONFLICT") {
      this.notified.delete(target);
      return false;
    }
    if (this.notified.has(target)) return false;
    this.notified.add(target);
    return true;
  }
}

export function accountForGitSyncTarget(target: GitSyncTarget): AccountId {
  return target === "local" ? LOCAL_ACCOUNT_ID : target;
}

function initial(action: GitAction): GitSyncStatus {
  return { state: "idle", action, lastAttemptAt: null };
}

/** Deterministic one-minute origin pull for every macOS profile; failures wait for the next interval. */
export class GitSynchronizer {
  private readonly now: () => number;
  private readonly statuses = new Map<GitSyncTarget, GitSyncStatus>([["local", initial("pull")]]);
  private readonly listeners = new Set<(target: GitSyncTarget, status: GitSyncStatus) => void>();
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly dependencies: GitSynchronizerDependencies) {
    this.now = dependencies.now ?? Date.now;
    this.refreshTargets();
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

  /** Adds newly provisioned registry slots before their next scheduled pull. */
  refreshTargets(): void {
    for (const target of this.botTargets()) {
      const id = this.targetId(target);
      if (!this.statuses.has(id)) this.statuses.set(id, initial("pull"));
    }
  }

  async syncNow(): Promise<void> {
    this.refreshTargets();
    await this.run("local", "pull", () => this.dependencies.pullLocal());
    for (const targets of this.botTargetGroups()) {
      const representative = targets[0]!;
      const id = this.targetId(representative);
      await this.run(id, "pull", () => this.dependencies.pullBot(representative));
      const status = this.snapshot(id);
      for (const alias of targets.slice(1)) this.statuses.set(this.targetId(alias), { ...status });
    }
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

  private botTargets(): Array<BotAccountId | CodexAccountSlot> {
    const slots = this.dependencies.profileSlots?.();
    return slots ? [...slots] : [...BOT_ACCOUNT_IDS];
  }

  private botTargetGroups(): Array<Array<BotAccountId | CodexAccountSlot>> {
    const groups = new Map<string, Array<BotAccountId | CodexAccountSlot>>();
    for (const target of this.botTargets()) {
      const workspace = typeof target === "string" ? target : target.workspaceRoot;
      const group = groups.get(workspace) ?? [];
      group.push(target);
      groups.set(workspace, group);
    }
    return [...groups.values()];
  }

  private targetId(target: BotAccountId | CodexAccountSlot): GitSyncTarget {
    return typeof target === "string" ? target : target.id;
  }
}
