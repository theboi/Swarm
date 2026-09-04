import {
  BOT_ACCOUNT_IDS,
  type AccountSnapshot,
  type BotAccountId,
  type DispatchRecord,
  type TaskNode,
  type ThreadSummary,
} from "../../shared/contracts.js";

export interface AutoPilotLaunch {
  taskId: string;
  accountId: BotAccountId;
}

export function shouldAutoArchive(record: Pick<DispatchRecord, "origin" | "state"> | undefined, provenComplete: boolean): boolean {
  return record?.origin === "auto_pilot" && provenComplete;
}

type AutoPilotSnapshot = Parameters<typeof selectAutoPilotLaunches>[0];
const asError = (cause: unknown): Error => cause instanceof Error ? cause : new Error(String(cause));

/** Refresh once, then isolate failures and recheck each original pairing without reallocating it. */
export async function reconcileAutoPilotLaunches(dependencies: {
  refresh(): Promise<void>;
  snapshot(): AutoPilotSnapshot;
  launch(pair: AutoPilotLaunch): Promise<unknown>;
  log(error: Error): void;
}): Promise<void> {
  await dependencies.refresh();
  const launches = selectAutoPilotLaunches(dependencies.snapshot());
  const results = await Promise.allSettled(launches.map(async (pair) => {
    const current = dependencies.snapshot();
    const eligible = selectAutoPilotLaunches({ ...current, tasks: current.tasks.filter((task) => task.id === pair.taskId), accounts: current.accounts.filter((account) => account.id === pair.accountId) });
    if (eligible.length) await dependencies.launch(pair);
  }));
  for (const result of results) if (result.status === "rejected") dependencies.log(asError(result.reason));
}

/** Completed dispatches retain provenance across restart; live receipt evidence gates every retry. */
export async function retryAutoPilotArchives(dependencies: {
  records(): DispatchRecord[];
  threads(): ThreadSummary[];
  provenComplete(record: DispatchRecord): boolean;
  archive(record: DispatchRecord): Promise<void>;
  log(error: Error): void;
}): Promise<void> {
  const candidates = dependencies.records().filter((record) => record.state === "completed"
    && shouldAutoArchive(record, dependencies.provenComplete(record))
    && dependencies.threads().some((thread) => thread.accountId === record.accountId && thread.id === record.threadId && !thread.archived));
  const results = await Promise.allSettled(candidates.map((record) => dependencies.archive(record)));
  for (const result of results) if (result.status === "rejected") dependencies.log(asError(result.reason));
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
