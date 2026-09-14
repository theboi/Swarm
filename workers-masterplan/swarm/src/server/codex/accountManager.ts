import { ACCOUNT_IDS, type AccountId, type AccountSnapshot, type CodexAccountSlot, type RateLimitWindow } from "../../shared/contracts.js";
import type { LaunchHandle, SuLauncher } from "./suLauncher.js";
import { codexLoginCommand } from "./terminalConsole.js";

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
  now?: () => number;
  /** Immutable registry-derived list for this runtime; defaults only for legacy bootstraps. */
  accountIds?: () => AccountId[];
  resolveSlot?: (account: AccountId) => CodexAccountSlot | undefined;
  /** Validates and registers an authenticated account before it becomes schedulable. */
  onAuthenticated?: (account: AccountId, metadata: Record<string, unknown>) => AccountSnapshot["identityDisplay"] | undefined;
  onDisconnected?: (account: AccountId) => void;
}

export interface ConnectAccountInput {
  account: AccountId;
  password?: string;
}

type ManagedConnection = { handle: LaunchHandle; client: ManagedAppServerClient; preAuth: boolean };

function isExpiredAuthentication(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const structured = error && typeof error === "object" && !Array.isArray(error) ? error as { code?: unknown; data?: unknown } : {};
  const metadata = structured.data === undefined ? "" : JSON.stringify(structured.data);
  return structured.code === 401
    || /token[_ -]?expired|provided authentication token is expired/i.test(`${message} ${metadata}`)
    || /(?:\b401\b.{0,80}\bunauthorized\b|\bunauthorized\b.{0,80}\b401\b)/i.test(message);
}

function explicitErrorCode(error: unknown): string | undefined {
  return error && typeof error === "object" && typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : undefined;
}

/** Tracks the one app-server process permitted for each macOS account. */
export class AccountManager {
  private readonly connections = new Map<AccountId, ManagedConnection>();
  private readonly snapshots = new Map<AccountId, AccountSnapshot>();
  private readonly inFlight = new Map<AccountId, Promise<AccountSnapshot>>();
  private readonly credentialVersions = new Map<AccountId, string | undefined>();
  private readonly recoveryRetryAt = new Map<AccountId, number>();
  private readonly recoveryRetryDelayMs = new Map<AccountId, number>();
  private readonly listeners = new Set<(snapshot: AccountSnapshot) => void>();
  private shuttingDown = false;

  constructor(private readonly options: AccountManagerOptions) {}

  connect(input: ConnectAccountInput): Promise<AccountSnapshot> {
    if (this.shuttingDown) return Promise.reject(new Error("ACCOUNT_OFFLINE"));
    if (!this.accountIds().includes(input.account)) return Promise.reject(new Error("Only allowlisted Swarm accounts may be connected"));
    const pending = this.inFlight.get(input.account);
    if (pending) return pending;
    const existing = this.connections.get(input.account);
    if (existing?.client.isConnected() && (this.requireSnapshot(input.account).authentication === "authenticated" || existing.preAuth)) return Promise.resolve(this.requireSnapshot(input.account));

    const connecting = (async () => {
      if (existing) await this.closeConnection(input.account);
      this.setSnapshot(input.account, { connection: "connecting", authentication: "unknown", terminalCommand: undefined, errorCode: undefined });
      return this.open(input);
    })().finally(() => this.inFlight.delete(input.account));
    this.inFlight.set(input.account, connecting);
    return connecting;
  }

  snapshot(account: AccountId): AccountSnapshot {
    return this.requireSnapshot(account);
  }

  snapshotsList(): AccountSnapshot[] {
    return this.accountIds().map((account) => this.requireSnapshot(account));
  }

  /** Returns a live app-server client only after account authentication completed. */
  client(account: AccountId): ManagedAppServerClient | undefined {
    if (this.snapshots.get(account)?.authentication !== "authenticated") return undefined;
    return this.connections.get(account)?.client;
  }

  /** Keeps the profile-scoped transport available while interactive login is pending. */
  preAuthClient(account: AccountId): ManagedAppServerClient | undefined {
    const connection = this.connections.get(account);
    return connection?.client.isConnected() ? connection.client : undefined;
  }

  async openTerminal(account: AccountId): Promise<void> {
    const target = this.terminalTarget(account);
    if (this.connections.has(account) && this.requireSnapshot(account).authentication === "authenticated") await this.options.launcher.openTerminal(account);
    else await this.options.launcher.openLoginTerminal(target, this.options.codexBin);
  }

  onChange(listener: (snapshot: AccountSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  updateSnapshot(account: AccountId, patch: Pick<Partial<AccountSnapshot>, "rateLimits" | "activeTurns" | "lastAssignedAt" | "errorCode" | "gitSync" | "hasBreakingChange" | "identityDisplay">): AccountSnapshot {
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

  markAuthenticated(account: AccountId, identityDisplay: AccountSnapshot["identityDisplay"]): AccountSnapshot {
    return this.setSnapshot(account, {
      connection: "connected",
      authentication: "authenticated",
      identityDisplay,
      terminalCommand: undefined,
      errorCode: undefined,
    });
  }

  recordRateLimitReadFailure(account: AccountId, error: unknown): AccountSnapshot {
    this.options.onRateLimitReadError?.(account, error);
    if (!isExpiredAuthentication(error)) return this.setSnapshot(account, { errorCode: "USAGE_UNAVAILABLE" });
    this.options.onDisconnected?.(account);
    const delay = this.recoveryRetryDelayMs.get(account) ?? 30_000;
    this.recoveryRetryAt.set(account, (this.options.now?.() ?? Date.now()) + delay);
    this.recoveryRetryDelayMs.set(account, Math.min(delay * 2, 15 * 60_000));
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
    const changed = current !== undefined && current !== this.credentialVersions.get(input.account);
    if (!options.force && !changed) {
      const now = this.options.now?.() ?? Date.now();
      if (now < (this.recoveryRetryAt.get(input.account) ?? 0)) return snapshot;
      const delay = this.recoveryRetryDelayMs.get(input.account) ?? 30_000;
      this.recoveryRetryAt.set(input.account, now + delay);
      this.recoveryRetryDelayMs.set(input.account, Math.min(delay * 2, 15 * 60_000));
    }
    return this.connect(input);
  }

  async disconnect(account: AccountId): Promise<void> {
    await this.closeConnection(account);
    this.setSnapshot(account, { connection: "disconnected", authentication: "unknown", terminalCommand: undefined, errorCode: undefined });
  }

  /** Closes a profile connection when an external identity guard rejects it. */
  async rejectAuthentication(account: AccountId, errorCode = "IDENTITY_ALREADY_CONNECTED"): Promise<void> {
    await this.closeConnection(account);
    this.setSnapshot(account, {
      connection: "action_required",
      authentication: "unauthenticated",
      identityDisplay: undefined,
      errorCode,
      terminalCommand: this.manualLoginCommand(account),
    });
  }

  private async closeConnection(account: AccountId): Promise<void> {
    const connection = this.connections.get(account);
    this.connections.delete(account);
    if (connection) {
      this.options.onDisconnected?.(account);
      await connection.client.close();
      await connection.handle.stop();
    }
  }

  async shutdown(): Promise<void> {
    this.shuttingDown = true;
    await Promise.all([...this.connections.keys()].map((account) => this.disconnect(account)));
    await this.options.launcher.shutdown();
  }

  private async open(input: ConnectAccountInput): Promise<AccountSnapshot> {
    let handle: LaunchHandle | undefined;
    let client: ManagedAppServerClient | undefined;
    let identityRegistered = false;
    try {
      this.credentialVersions.set(input.account, await this.readCredentialVersion(input.account));
      const slot = this.options.resolveSlot?.(input.account);
      handle = await this.options.launcher.launch({ account: input.account, ...(slot ? { slot } : {}), password: input.password, codexBin: this.options.codexBin });
      client = this.options.createClient(handle);
      const account = await client.connect();
      if (!account.account) {
        this.connections.set(input.account, { handle, client, preAuth: true });
        return this.setSnapshot(input.account, {
          connection: "action_required",
          authentication: "unauthenticated",
          errorCode: "ACCOUNT_AUTH_REQUIRED",
          terminalCommand: this.manualLoginCommand(input.account),
        });
      }
      const identityDisplay = this.options.onAuthenticated?.(input.account, account.account);
      identityRegistered = true;
      let rateLimits = this.requireSnapshot(input.account).rateLimits;
      let rateLimitError: unknown;
      try {
        rateLimits = await client.readRateLimitWindows();
      } catch (error) {
        rateLimitError = error;
      }
      this.connections.set(input.account, { handle, client, preAuth: false });
      if (rateLimitError !== undefined) {
        this.setSnapshot(input.account, { connection: "connected", authentication: "authenticated", rateLimits, identityDisplay, terminalCommand: undefined });
        return this.recordRateLimitReadFailure(input.account, rateLimitError);
      }
      const snapshot = this.recordRateLimitReadSuccess(input.account, rateLimits);
      if (identityDisplay) this.updateSnapshot(input.account, { identityDisplay });
      this.recoveryRetryAt.delete(input.account);
      this.recoveryRetryDelayMs.delete(input.account);
      return snapshot;
    } catch (error) {
      await client?.close().catch(() => undefined);
      await handle?.stop();
      if (identityRegistered) this.options.onDisconnected?.(input.account);
      const errorCode = explicitErrorCode(error) ?? "ACCOUNT_AUTH_REQUIRED";
      this.setSnapshot(input.account, {
        connection: "action_required",
        authentication: "unauthenticated",
        identityDisplay: undefined,
        errorCode,
        terminalCommand: this.manualLoginCommand(input.account),
      });
      if (errorCode === "IDENTITY_ALREADY_CONNECTED") throw error;
      throw new Error("ACCOUNT_AUTH_REQUIRED");
    }
  }

  private manualLoginCommand(account: AccountId): string {
    return codexLoginCommand(this.terminalTarget(account), this.options.codexBin);
  }

  private terminalTarget(account: AccountId): AccountId | CodexAccountSlot {
    return this.options.resolveSlot?.(account) ?? account;
  }

  private async readCredentialVersion(account: AccountId): Promise<string | undefined> {
    try { return await this.options.credentialVersion?.(account); }
    catch { return undefined; }
  }

  private accountIds(): AccountId[] {
    return [...(this.options.accountIds?.() ?? ACCOUNT_IDS)];
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
