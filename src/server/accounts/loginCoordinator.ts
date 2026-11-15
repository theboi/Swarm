import { createHash } from "node:crypto";

import type { AccountIdentityDisplay, BotProfileAccountId, ProfileLoginChallenge } from "../../shared/contracts.js";

export type LoginMethod = ProfileLoginChallenge["method"];

export interface PublicLoginChallenge {
  accountId: BotProfileAccountId;
  method: LoginMethod;
  verificationUrl: string;
  expiresAt: number;
}

export interface LoginCompletionAppServer {
  onEvent(listener: (event: { type: string; state?: string }) => void): () => void;
  readAccount(): Promise<{ account: Record<string, unknown> | null }>;
}

export class LoginCoordinatorError extends Error {
  constructor(readonly code: "LOGIN_EXPIRED" | "LOGIN_CANCELLED" | "IDENTITY_ALREADY_CONNECTED" | "DEVICE_AUTH_UNAVAILABLE", message: string = code) {
    super(message);
  }
}

type PendingChallenge = ProfileLoginChallenge & { startedAt: number };

export class LoginCoordinator {
  private readonly pending = new Map<BotProfileAccountId, PendingChallenge>();
  private readonly fingerprintByAccount = new Map<BotProfileAccountId, string>();
  private readonly accountByFingerprint = new Map<string, BotProfileAccountId>();

  constructor(private readonly options: {
    start(accountId: BotProfileAccountId, method: LoginMethod): Promise<ProfileLoginChallenge>;
    cancel(accountId: BotProfileAccountId, loginId: string): Promise<void>;
    now?: () => number;
    fingerprintSalt: string;
    onCompletion?: (accountId: BotProfileAccountId, identity: AccountIdentityDisplay) => void;
    onFailure?: (accountId: BotProfileAccountId, error: LoginCoordinatorError) => void;
  }) {}

  async start(accountId: BotProfileAccountId, method: LoginMethod): Promise<ProfileLoginChallenge> {
    await this.cancel(accountId);
    const startedAt = this.now();
    const response = await this.options.start(accountId, method);
    if (!response.loginId || !response.verificationUrl || (method === "device_code" && !response.userCode)) {
      throw new LoginCoordinatorError("DEVICE_AUTH_UNAVAILABLE");
    }
    const challenge: PendingChallenge = {
      accountId,
      loginId: response.loginId,
      method,
      verificationUrl: response.verificationUrl,
      ...(response.userCode ? { userCode: response.userCode } : {}),
      startedAt,
      expiresAt: startedAt + 600_000,
    };
    this.pending.set(accountId, challenge);
    return profileChallenge(challenge);
  }

  async cancel(accountId: BotProfileAccountId): Promise<void> {
    const challenge = this.pending.get(accountId);
    if (!challenge) return;
    this.pending.delete(accountId);
    await this.options.cancel(accountId, challenge.loginId);
  }

  complete(accountId: BotProfileAccountId, metadata: Record<string, unknown>): AccountIdentityDisplay {
    const challenge = this.pending.get(accountId);
    if (!challenge) throw new LoginCoordinatorError("LOGIN_EXPIRED");
    this.pending.delete(accountId);
    const identity = this.registerConnectedIdentity(accountId, metadata);
    this.options.onCompletion?.(accountId, identity);
    return identity;
  }

  /** Rebuilds the in-memory duplicate-identity guard after a process restart or reconnect. */
  registerConnectedIdentity(accountId: BotProfileAccountId, metadata: Record<string, unknown>): AccountIdentityDisplay {
    const identity = displayIdentity(metadata);
    const fingerprint = fingerprintIdentity(metadata, this.options.fingerprintSalt);
    const connectedAccount = this.accountByFingerprint.get(fingerprint);
    if (connectedAccount && connectedAccount !== accountId) throw new LoginCoordinatorError("IDENTITY_ALREADY_CONNECTED");
    this.disconnect(accountId);
    this.fingerprintByAccount.set(accountId, fingerprint);
    this.accountByFingerprint.set(fingerprint, accountId);
    return identity;
  }

  expire(now = this.now()): BotProfileAccountId[] {
    const expired: BotProfileAccountId[] = [];
    for (const [accountId, challenge] of this.pending) {
      if (challenge.expiresAt > now) continue;
      this.pending.delete(accountId);
      expired.push(accountId);
    }
    return expired;
  }

  challengeState(accountId: BotProfileAccountId): PublicLoginChallenge | undefined {
    const challenge = this.pending.get(accountId);
    return challenge && {
      accountId: challenge.accountId,
      method: challenge.method,
      verificationUrl: challenge.verificationUrl,
      expiresAt: challenge.expiresAt,
    };
  }

  connectedAccount(accountId: BotProfileAccountId): boolean {
    return this.fingerprintByAccount.has(accountId);
  }

  /** Completion notifications carry no trusted identity data, so always re-read it. */
  bindAppServer(accountId: BotProfileAccountId, client: LoginCompletionAppServer): () => void {
    return client.onEvent((event) => {
      if (event.type !== "account" || (event.state !== "login_completed" && event.state !== "updated")) return;
      void client.readAccount().then((result) => {
        if (!result.account) return;
        try {
          if (this.pending.has(accountId)) this.complete(accountId, result.account);
          else {
            const identity = this.registerConnectedIdentity(accountId, result.account);
            this.options.onCompletion?.(accountId, identity);
          }
        } catch (error) {
          if (error instanceof LoginCoordinatorError) this.options.onFailure?.(accountId, error);
        }
      }).catch(() => undefined);
    });
  }

  disconnect(accountId: BotProfileAccountId): void {
    const fingerprint = this.fingerprintByAccount.get(accountId);
    if (fingerprint) this.accountByFingerprint.delete(fingerprint);
    this.fingerprintByAccount.delete(accountId);
  }

  /** Login IDs and device codes are intentionally never JSON-serializable state. */
  toJSON(): Record<string, never> { return {}; }

  private now(): number { return this.options.now?.() ?? Date.now(); }
}

function displayIdentity(metadata: Record<string, unknown>): AccountIdentityDisplay {
  const read = (key: string): string | undefined => typeof metadata[key] === "string" && metadata[key].trim() ? metadata[key].trim() : undefined;
  return {
    ...(read("email") ? { email: read("email") } : {}),
    ...(read("workspace") ? { workspace: read("workspace") } : {}),
    ...(read("planType") ? { planType: read("planType") } : {}),
  };
}

function fingerprintIdentity(metadata: Record<string, unknown>, salt: string): string {
  // Workspace and plan metadata identify a subscription context, not a person.
  // Prefer an account-scoped identifier and fall back to a normalized email;
  // only the salted digest is retained in memory.
  const stableKeys = ["id", "accountId", "userId"];
  const stable = stableKeys.flatMap((key) => typeof metadata[key] === "string" && metadata[key].trim() ? [[key, metadata[key].trim()]] : []);
  const email = typeof metadata.email === "string" && metadata.email.trim() ? metadata.email.trim().toLowerCase() : undefined;
  if (stable.length === 0 && email) stable.push(["email", email]);
  if (stable.length === 0) throw new LoginCoordinatorError("DEVICE_AUTH_UNAVAILABLE", "Codex did not provide stable identity metadata");
  return createHash("sha256").update(salt).update("\0").update(JSON.stringify(stable)).digest("hex");
}

function profileChallenge(challenge: PendingChallenge): ProfileLoginChallenge {
  return {
    accountId: challenge.accountId,
    loginId: challenge.loginId,
    method: challenge.method,
    verificationUrl: challenge.verificationUrl,
    ...(challenge.userCode ? { userCode: challenge.userCode } : {}),
    expiresAt: challenge.expiresAt,
  };
}
