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
  refresh(): Promise<ReadonlySet<BotAccountId>>;
  snapshot(): AutoPilotSnapshot;
  launch(pair: AutoPilotLaunch): Promise<unknown>;
  log(error: Error): void;
}): Promise<void> {
  const refreshedAccounts = await dependencies.refresh();
  const eligibleSnapshot = (): AutoPilotSnapshot => {
    const current = dependencies.snapshot();
    return { ...current, accounts: current.accounts.filter((account) => refreshedAccounts.has(account.id as BotAccountId)) };
  };
  const launches = selectAutoPilotLaunches(eligibleSnapshot());
  const results = await Promise.allSettled(launches.map(async (pair) => {
    const current = eligibleSnapshot();
    const eligible = selectAutoPilotLaunches({ ...current, tasks: current.tasks.filter((task) => task.id === pair.taskId), accounts: current.accounts.filter((account) => account.id === pair.accountId) });
    if (eligible.length) await dependencies.launch(pair);
  }));
  for (const result of results) if (result.status === "rejected") dependencies.log(asError(result.reason));
}

/** Reads autonomous accepted work after restart and settles only a finished, receipt-proven launch. */
export async function recoverAcceptedAutoPilotDispatches(dependencies: {
  records(): DispatchRecord[];
  readCompleted(record: DispatchRecord): Promise<boolean>;
  provenComplete(record: DispatchRecord): boolean;
  settle(record: DispatchRecord): Promise<void>;
  log(error: Error): void;
}): Promise<void> {
  const candidates = dependencies.records().filter((record) => record.origin === "auto_pilot" && record.state === "accepted");
  const results = await Promise.allSettled(candidates.map(async (record) => {
    const threadCompleted = await dependencies.readCompleted(record);
    if (threadCompleted && dependencies.provenComplete(record)) await dependencies.settle(record);
  }));
  for (const result of results) if (result.status === "rejected") dependencies.log(asError(result.reason));
}

/** Matches app-server's latest-turn completion semantics without treating exhausted turns as complete. */
export function latestThreadTurnCompleted(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const response = value as Record<string, unknown>;
  const thread = response.thread && typeof response.thread === "object" && !Array.isArray(response.thread) ? response.thread as Record<string, unknown> : response;
  if (!Array.isArray(thread.turns)) return false;
  const latest = thread.turns.filter((turn): turn is Record<string, unknown> => Boolean(turn) && typeof turn === "object" && !Array.isArray(turn))
    .sort((left, right) => (typeof left.startedAt === "number" ? left.startedAt : -1) - (typeof right.startedAt === "number" ? right.startedAt : -1)).at(-1);
  if (!latest) return false;
  const rawStatus = latest.status;
  const status = typeof rawStatus === "string" ? rawStatus : rawStatus && typeof rawStatus === "object" && !Array.isArray(rawStatus) ? (rawStatus as Record<string, unknown>).type : undefined;
  if (typeof status !== "string" || !["complete", "completed"].includes(status.replace(/[ _-]/g, "").toLowerCase())) return false;
  const error = latest.error && typeof latest.error === "object" && !Array.isArray(latest.error) ? latest.error as Record<string, unknown> : undefined;
  if (error?.codexErrorInfo === "sessionBudgetExceeded" || error?.codexErrorInfo === "usageLimitExceeded") return false;
  const serializedError = error ? JSON.stringify(error) : "";
  return !/(?:session|usage|rate).{0,24}limit|limit.{0,24}(?:exceed|reset)/i.test(serializedError);
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
