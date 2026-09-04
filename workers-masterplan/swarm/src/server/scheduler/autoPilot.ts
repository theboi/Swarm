import {
  BOT_ACCOUNT_IDS,
  type AccountSnapshot,
  type BotAccountId,
  type TaskNode,
  type ThreadSummary,
} from "../../shared/contracts.js";

export interface AutoPilotLaunch {
  taskId: string;
  accountId: BotAccountId;
}

export function selectAutoPilotLaunches(input: {
  tasks: TaskNode[];
  accounts: AccountSnapshot[];
  threads: ThreadSummary[];
}): AutoPilotLaunch[] {
  const occupied = new Set(input.threads.filter((thread) => !thread.archived).map((thread) => thread.accountId));
  const idleBots = BOT_ACCOUNT_IDS.filter((id) => {
    const account = input.accounts.find((candidate) => candidate.id === id);
    return account?.connection === "connected"
      && account.authentication === "authenticated"
      && !occupied.has(id);
  });
  const ready = input.tasks.filter((task) => task.readiness.state === "ready");
  return ready.slice(0, idleBots.length).map((task, index) => ({ taskId: task.id, accountId: idleBots[index] }));
}

export interface AutoPilotDependencies {
  isEnabled(): boolean;
  reconcile(): Promise<void>;
  log(error: Error): void;
  intervalMs: number;
}

export class AutoPilotController {
  private readonly dependencies: AutoPilotDependencies;
  private running = false;
  private requested = false;
  private stopped = false;
  private interval: ReturnType<typeof setInterval> | undefined;
  private idleWaiters: Array<() => void> = [];

  public constructor(dependencies: AutoPilotDependencies) {
    this.dependencies = dependencies;
  }

  public start(): void {
    if (this.stopped || this.interval !== undefined) return;
    this.interval = setInterval(() => this.request(), this.dependencies.intervalMs);
    (this.interval as ReturnType<typeof setInterval> & { unref?: () => void }).unref?.();
    this.request();
  }

  public request(): void {
    if (this.stopped) return;
    this.requested = true;
    if (!this.running) void this.drain();
  }

  public whenIdle(): Promise<void> {
    if (!this.running && !this.requested) return Promise.resolve();
    return new Promise<void>((resolve) => this.idleWaiters.push(resolve));
  }

  public stop(): void {
    this.stopped = true;
    this.requested = false;
    if (this.interval !== undefined) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
    this.resolveIdleWaitersIfIdle();
  }

  private async drain(): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      do {
        this.requested = false;
        if (this.stopped) break;
        if (!this.dependencies.isEnabled()) continue;
        try {
          await this.dependencies.reconcile();
        } catch (cause) {
          this.dependencies.log(cause instanceof Error ? cause : new Error(String(cause)));
        }
      } while (this.requested && !this.stopped);
    } finally {
      this.running = false;
      this.resolveIdleWaitersIfIdle();
    }
  }

  private resolveIdleWaitersIfIdle(): void {
    if (this.running || this.requested) return;
    const waiters = this.idleWaiters.splice(0);
    for (const resolve of waiters) resolve();
  }
}
