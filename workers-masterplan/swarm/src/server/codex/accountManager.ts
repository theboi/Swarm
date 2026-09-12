import { ACCOUNT_IDS, type AccountId, type AccountSnapshot, type RateLimitWindow } from "../../shared/contracts.js";
import type { LaunchHandle, SuLauncher } from "./suLauncher.js";
import { codexLoginCommand } from "./terminalConsole.js";

const ACCOUNTS = new Set<AccountId>(ACCOUNT_IDS);

export interface ManagedAppServerClient {
  connect(): Promise<{ account: Record<string, unknown> | null; requiresOpenaiAuth: boolean }>;
  isConnected(): boolean;
  readRateLimitWindows(): Promise<RateLimitWindow[]>;
  close(): Promise<void>;
}

export interface AccountManagerOptions {
  launcher: SuLauncher;
  createClient(handle: LaunchHandle): ManagedAppServerClient;
  codexBin: string;
  onRateLimitReadError?: (account: AccountId, error: unknown) => void;
  credentialVersion?: (account: AccountId) => Promise<string | undefined>;
}

export interface ConnectAccountInput {
  account: AccountId;
  password?: string;
}

type ManagedConnection = { handle: LaunchHandle; client: ManagedAppServerClient };

function isExpiredAuthentication(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const structured = error && typeof error === "object" && !Array.isArray(error) ? error as { code?: unknown; data?: unknown } : {};
  const metadata = structured.data === undefined ? "" : JSON.stringify(structured.data);
  return structured.code === 401
    || /token[_ -]?expired|provided authentication token is expired/i.test(`${message} ${metadata}`)
    || /(?:\b401\b.{0,80}\bunauthorized\b|\bunauthorized\b.{0,80}\b401\b)/i.test(message);
}

/** Tracks the one app-server process permitted for each macOS account. */
export class AccountManager {
  private readonly connections = new Map<AccountId, ManagedConnection>();
  private readonly snapshots = new Map<AccountId, AccountSnapshot>();
  private readonly inFlight = new Map<AccountId, Promise<AccountSnapshot>>();
  private readonly credentialVersions = new Map<AccountId, string | undefined>();
  private readonly listeners = new Set<(snapshot: AccountSnapshot) => void>();
  private shuttingDown = false;

  constructor(private readonly options: AccountManagerOptions) {}

  connect(input: ConnectAccountInput): Promise<AccountSnapshot> {
    if (this.shuttingDown) return Promise.reject(new Error("ACCOUNT_OFFLINE"));
    if (!ACCOUNTS.has(input.account)) return Promise.reject(new Error("Only allowlisted Swarm accounts may be connected"));
    const existing = this.connections.get(input.account);
    if (existing?.client.isConnected() && this.requireSnapshot(input.account).authentication === "authenticated") return Promise.resolve(this.requireSnapshot(input.account));
    if (existing) return this.disconnect(input.account).then(() => this.connect(input));
    const pending = this.inFlight.get(input.account);
    if (pending) return pending;

    this.setSnapshot(input.account, { connection: "connecting", authentication: "unknown" });
    const connecting = this.open(input).finally(() => this.inFlight.delete(input.account));
    this.inFlight.set(input.account, connecting);
    return connecting;
  }

  snapshot(account: AccountId): AccountSnapshot {
    return this.requireSnapshot(account);
  }

  snapshotsList(): AccountSnapshot[] {
    return ACCOUNT_IDS.map((account) => this.requireSnapshot(account));
  }

  /** Returns a live app-server client only after account authentication completed. */
  client(account: AccountId): ManagedAppServerClient | undefined {
    if (this.snapshots.get(account)?.authentication !== "authenticated") return undefined;
    return this.connections.get(account)?.client;
  }

  async openTerminal(account: AccountId): Promise<void> {
    if (this.connections.has(account) && this.requireSnapshot(account).authentication === "authenticated") await this.options.launcher.openTerminal(account);
    else await this.options.launcher.openLoginTerminal(account, this.options.codexBin);
  }

  onChange(listener: (snapshot: AccountSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  updateSnapshot(account: AccountId, patch: Pick<Partial<AccountSnapshot>, "rateLimits" | "activeTurns" | "lastAssignedAt" | "errorCode" | "gitSync" | "hasBreakingChange">): AccountSnapshot {
    return this.setSnapshot(account, patch);
  }

  recordRateLimitReadSuccess(account: AccountId, rateLimits: RateLimitWindow[]): AccountSnapshot {
    return this.setSnapshot(account, {
      connection: "connected",
      authentication: "authenticated",
      rateLimits,
      terminalCommand: undefined,
      errorCode: undefined,
    });
  }

  recordRateLimitReadFailure(account: AccountId, error: unknown): AccountSnapshot {
    this.options.onRateLimitReadError?.(account, error);
    if (!isExpiredAuthentication(error)) return this.setSnapshot(account, { errorCode: "USAGE_UNAVAILABLE" });
    return this.setSnapshot(account, {
      connection: "action_required",
      authentication: "unauthenticated",
      errorCode: "ACCOUNT_AUTH_REQUIRED",
      terminalCommand: this.manualLoginCommand(account),
    });
  }

  /** Replaces a stale unauthenticated app-server after its account credentials change. */
  async recoverChangedCredentials(input: ConnectAccountInput, options: { force?: boolean } = {}): Promise<AccountSnapshot> {
    const snapshot = this.requireSnapshot(input.account);
    if (snapshot.authentication !== "unauthenticated" || snapshot.activeTurns > 0) return snapshot;
    const current = await this.readCredentialVersion(input.account);
    if (!options.force && current !== undefined && current === this.credentialVersions.get(input.account)) return snapshot;
    return this.connect(input);
  }

  async disconnect(account: AccountId): Promise<void> {
    const connection = this.connections.get(account);
    this.connections.delete(account);
    if (connection) {
      await connection.client.close();
      await connection.handle.stop();
    }
    this.setSnapshot(account, { connection: "disconnected", authentication: "unknown", terminalCommand: undefined, errorCode: undefined });
  }

  async shutdown(): Promise<void> {
    this.shuttingDown = true;
    await Promise.all([...this.connections.keys()].map((account) => this.disconnect(account)));
    await this.options.launcher.shutdown();
  }

  private async open(input: ConnectAccountInput): Promise<AccountSnapshot> {
    let handle: LaunchHandle | undefined;
    try {
      this.credentialVersions.set(input.account, await this.readCredentialVersion(input.account));
      handle = await this.options.launcher.launch({ account: input.account, password: input.password, codexBin: this.options.codexBin });
      const client = this.options.createClient(handle);
      const account = await client.connect();
      if (!account.account) throw new Error("ACCOUNT_AUTH_REQUIRED");
      let rateLimits = this.requireSnapshot(input.account).rateLimits;
      let rateLimitError: unknown;
      try {
        rateLimits = await client.readRateLimitWindows();
      } catch (error) {
        rateLimitError = error;
      }
      this.connections.set(input.account, { handle, client });
      if (rateLimitError !== undefined) {
        this.setSnapshot(input.account, { connection: "connected", authentication: "authenticated", rateLimits, terminalCommand: undefined });
        return this.recordRateLimitReadFailure(input.account, rateLimitError);
      }
      return this.recordRateLimitReadSuccess(input.account, rateLimits);
    } catch (error) {
      await handle?.stop();
      this.setSnapshot(input.account, {
        connection: "action_required",
        authentication: "unauthenticated",
        errorCode: "ACCOUNT_AUTH_REQUIRED",
        terminalCommand: this.manualLoginCommand(input.account),
      });
      throw new Error("ACCOUNT_AUTH_REQUIRED");
    }
  }

  private manualLoginCommand(account: AccountId): string {
    return codexLoginCommand(account, this.options.codexBin);
  }

  private async readCredentialVersion(account: AccountId): Promise<string | undefined> {
    try { return await this.options.credentialVersion?.(account); }
    catch { return undefined; }
  }

  private requireSnapshot(account: AccountId): AccountSnapshot {
    return this.snapshots.get(account) ?? this.setSnapshot(account, { connection: "disconnected", authentication: "unknown" });
  }

  private setSnapshot(account: AccountId, patch: Partial<AccountSnapshot>): AccountSnapshot {
    const previous = this.snapshots.get(account);
    const next: AccountSnapshot = {
      id: account,
      connection: "disconnected",
      authentication: "unknown",
      rateLimits: [],
      activeTurns: 0,
      lastAssignedAt: null,
      ...previous,
      ...patch,
    };
    this.snapshots.set(account, next);
    const publicSnapshot = { ...next, rateLimits: next.rateLimits.map((window) => ({ ...window })) };
    for (const listener of this.listeners) listener(publicSnapshot);
    return publicSnapshot;
  }
}
