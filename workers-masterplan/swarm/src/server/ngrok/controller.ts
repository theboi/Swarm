import { isNgrokWindowOpen, nextNgrokBoundary, nextNgrokStart } from "./window.js";
export { isNgrokWindowOpen, nextNgrokBoundary } from "./window.js";

interface TunnelDiscovery {
  healthy: boolean;
  id: string;
  publicUrl?: string | null;
  /** Inspector metadata alone does not establish ownership of a tunnel. */
  owned?: boolean;
}
interface PersistedNgrokState { suppressUntil?: number; publicUrl?: string | null; managedTunnelId?: string | null }
interface StartedTunnel { id: string; publicUrl?: string | null }

function safePublicUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch { return null; }
}

export class NgrokController {
  private running = false;
  private publicUrl: string | null;
  private queue = Promise.resolve();
  private heartbeat: unknown;
  private forceRestart = false;
  private lastError: string | null = null;

  constructor(private readonly options: {
    timezone?: string;
    persistence: PersistedNgrokState;
    persist?: () => Promise<void>;
    start(): Promise<StartedTunnel>;
    stop(): Promise<void>;
    isHealthy?: () => Promise<boolean>;
    discover?: () => Promise<TunnelDiscovery>;
    /** Reports background reconciliation failures that have no caller to await them. */
    onError?: (error: unknown) => void;
    clock?: () => Date;
    timer?: { setEveryMinute(callback: () => void): unknown; clear(handle: unknown): void };
  }) {
    this.publicUrl = safePublicUrl(options.persistence.publicUrl);
  }

  reconcile(now = this.now()): Promise<void> { return this.serial(() => this.reconcileOne(now)); }

  stopEarly(now = this.now()): Promise<void> {
    return this.serial(async () => {
      this.options.persistence.suppressUntil = nextNgrokStart(now, this.options.timezone).getTime();
      await this.persist();
      if (this.running) await this.stopManaged();
    });
  }

  shutdown(): Promise<void> {
    this.stopHeartbeat();
    return this.serial(async () => {
      if (this.running) await this.stopManaged();
    });
  }

  notifyProcessExit(now = this.now()): Promise<void> {
    return this.serial(async () => {
      this.running = false;
      this.forceRestart = true;
      this.options.persistence.managedTunnelId = null;
      await this.clearPublicUrl();
      await this.reconcileOne(now);
    });
  }

  startHeartbeat(): void {
    if (this.heartbeat !== undefined) return;
    const timer = this.options.timer ?? {
      setEveryMinute: (callback: () => void) => setInterval(callback, 60_000),
      clear: (handle: unknown) => clearInterval(handle as NodeJS.Timeout),
    };
    this.heartbeat = timer.setEveryMinute(() => {
      void this.reconcile().catch((error) => this.options.onError?.(error));
    });
  }

  stopHeartbeat(): void {
    if (this.heartbeat === undefined) return;
    const timer = this.options.timer ?? { setEveryMinute: () => undefined, clear: (handle: unknown) => clearInterval(handle as NodeJS.Timeout) };
    timer.clear(this.heartbeat);
    this.heartbeat = undefined;
  }

  snapshot(now = this.now()) {
    return {
      state: this.lastError ? "error" : this.running ? "running" : "stopped",
      running: this.running,
      suppressed: (this.options.persistence.suppressUntil ?? 0) > now.getTime(),
      publicUrl: this.publicUrl,
      error: this.lastError,
      nextBoundaryAt: nextNgrokBoundary(now, this.options.timezone).getTime(),
    };
  }

  private now(): Date { return this.options.clock?.() ?? new Date(); }

  private serial(operation: () => Promise<void>): Promise<void> {
    const next = this.queue.then(operation);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async reconcileOne(now: Date): Promise<void> {
    const open = isNgrokWindowOpen(now, this.options.timezone);
    const suppressed = (this.options.persistence.suppressUntil ?? 0) > now.getTime();
    if (this.running && !this.forceRestart && this.options.isHealthy && !(await this.options.isHealthy())) {
      this.running = false;
      await this.clearPublicUrl();
    }
    if (!this.running && !this.forceRestart && this.options.discover) {
      const discovered = await this.options.discover();
      if (discovered.healthy && discovered.owned === true && discovered.id === this.options.persistence.managedTunnelId) {
        this.running = true;
        await this.setPublicUrl(discovered.publicUrl ?? this.options.persistence.publicUrl);
      }
    }
    if (!open || suppressed) {
      if (this.running) await this.stopManaged();
      return;
    }
    if (this.running && !this.forceRestart) return;
    this.forceRestart = false;
    try {
      const started = await this.options.start();
      if (!started.id.trim()) throw new Error("Managed ngrok launch did not return a tunnel identity");
      this.options.persistence.managedTunnelId = started.id;
      this.running = true;
      this.lastError = null;
      await this.setPublicUrl(started.publicUrl);
    } catch (error) {
      this.running = false;
      this.lastError = error instanceof Error ? error.message : "ngrok start failed";
      await this.clearPublicUrl();
      throw error;
    }
  }

  private async stopManaged(): Promise<void> {
    await this.options.stop();
    this.running = false;
    this.options.persistence.managedTunnelId = null;
    await this.clearPublicUrl();
  }

  private async setPublicUrl(url: string | null | undefined): Promise<void> {
    this.publicUrl = safePublicUrl(url);
    this.options.persistence.publicUrl = this.publicUrl;
    await this.persist();
  }

  private async clearPublicUrl(): Promise<void> { await this.setPublicUrl(null); }
  private async persist(): Promise<void> { await this.options.persist?.(); }
}
