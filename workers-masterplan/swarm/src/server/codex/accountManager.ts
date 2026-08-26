import type { AccountId, AccountSnapshot } from "../../shared/contracts.js";
import type { LaunchHandle, SuLauncher } from "./suLauncher.js";

const ACCOUNTS = new Set<AccountId>(["bot1", "bot2", "bot3", "bot4", "bot5", "bot6", "bot7", "bot8"]);

export interface ManagedAppServerClient {
  connect(): Promise<{ account: Record<string, unknown> | null; requiresOpenaiAuth: boolean }>;
  close(): Promise<void>;
}

export interface AccountManagerOptions {
  launcher: SuLauncher;
  createClient(handle: LaunchHandle): ManagedAppServerClient;
  codexBin: string;
}

export interface ConnectAccountInput {
  account: AccountId;
  password: string;
}

type ManagedConnection = { handle: LaunchHandle; client: ManagedAppServerClient };

/** Tracks the one app-server process permitted for each macOS account. */
export class AccountManager {
  private readonly connections = new Map<AccountId, ManagedConnection>();
  private readonly snapshots = new Map<AccountId, AccountSnapshot>();
  private readonly inFlight = new Map<AccountId, Promise<AccountSnapshot>>();
  private readonly listeners = new Set<(snapshot: AccountSnapshot) => void>();
  private shuttingDown = false;

  constructor(private readonly options: AccountManagerOptions) {}

  connect(input: ConnectAccountInput): Promise<AccountSnapshot> {
    if (this.shuttingDown) return Promise.reject(new Error("ACCOUNT_OFFLINE"));
    if (!ACCOUNTS.has(input.account)) return Promise.reject(new Error("Only allowlisted bot1 through bot8 accounts may be connected"));
    const existing = this.connections.get(input.account);
    if (existing) return Promise.resolve(this.requireSnapshot(input.account));
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
    return (["bot1", "bot2", "bot3", "bot4", "bot5", "bot6", "bot7", "bot8"] as AccountId[]).map((account) => this.requireSnapshot(account));
  }

  /** Returns a live app-server client only after account authentication completed. */
  client(account: AccountId): ManagedAppServerClient | undefined {
    return this.connections.get(account)?.client;
  }

  onChange(listener: (snapshot: AccountSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  updateSnapshot(account: AccountId, patch: Pick<Partial<AccountSnapshot>, "rateLimits" | "activeTurns" | "lastAssignedAt" | "errorCode">): AccountSnapshot {
    return this.setSnapshot(account, patch);
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
      handle = await this.options.launcher.launch({ account: input.account, password: input.password, codexBin: this.options.codexBin });
      const client = this.options.createClient(handle);
      const account = await client.connect();
      if (!account.account || account.requiresOpenaiAuth) throw new Error("ACCOUNT_AUTH_REQUIRED");
      this.connections.set(input.account, { handle, client });
      return this.setSnapshot(input.account, { connection: "connected", authentication: "authenticated", terminalCommand: undefined, errorCode: undefined });
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
    return `/usr/bin/su - ${account} -c '${this.options.codexBin.replaceAll("'", "'\\''")} login'`;
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
