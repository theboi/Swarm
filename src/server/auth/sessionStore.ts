import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const CHALLENGE_TTL_MS = 5 * 60_000;
const IDLE_TTL_MS = 30 * 24 * 60 * 60_000;

interface Challenge { email: string; expiresAt: number; used: boolean }
interface Session { email: string; idleDeadline: number; signature: string }
interface PersistedAuth { challenges?: Record<string, Challenge>; sessions?: Record<string, Session> }

function digest(secret: string, value: string): string { return createHmac("sha256", secret).update(value).digest("base64url"); }
function normalizedEmail(email: string): string { return email.trim().toLowerCase(); }
function isLoopback(address: string): boolean { return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1"; }

export function resolveLoginSource(input: { directAddress: string; forwardedFor?: string; trustManagedProxy: boolean }): string {
  if (!input.trustManagedProxy || !isLoopback(input.directAddress) || !input.forwardedFor) return input.directAddress;
  return input.forwardedFor.split(",")[0]?.trim() || input.directAddress;
}

export class LoginThrottle {
  private readonly entries = new Map<string, { failures: number; retryAt: number }>();
  private mutation = Promise.resolve();
  constructor(private readonly options: { limit?: number; baseBackoffMs?: number; maxBackoffMs?: number; persistence?: { loginThrottle?: Record<string, { failures: number; retryAt: number }> }; persist?: () => Promise<void> } = {}) {
    for (const [key, value] of Object.entries(options.persistence?.loginThrottle ?? {})) this.entries.set(key, { ...value });
  }
  private keys(email: string, source: string) { return [`email:${normalizedEmail(email)}`, `source:${source}`]; }
  check(email: string, source: string, now = Date.now()): { allowed: true } | { allowed: false; retryAt: number } {
    const blocked = this.keys(email, source).map((key) => this.entries.get(key)).filter((entry): entry is { failures: number; retryAt: number } => Boolean(entry && entry.retryAt > now));
    return blocked.length ? { allowed: false, retryAt: Math.max(...blocked.map((entry) => entry.retryAt)) } : { allowed: true };
  }
  async recordFailure(email: string, source: string, now = Date.now()): Promise<void> {
    await this.mutate(() => {
      const limit = this.options.limit ?? 5;
      const base = this.options.baseBackoffMs ?? 1_000;
      const maximum = this.options.maxBackoffMs ?? 60 * 60_000;
      for (const key of this.keys(email, source)) {
        const previous = this.entries.get(key) ?? { failures: 0, retryAt: now };
        const failures = previous.failures + 1;
        this.entries.set(key, { failures, retryAt: failures >= limit ? now + Math.min(maximum, base * 2 ** Math.min(failures - limit, 52)) : now });
      }
    });
  }
  async recordSuccess(email: string, source: string): Promise<void> { await this.mutate(() => { for (const key of this.keys(email, source)) this.entries.delete(key); }); }

  private async mutate(change: () => void): Promise<void> {
    const next = this.mutation.then(async () => {
      const before = new Map([...this.entries].map(([key, value]) => [key, { ...value }]));
      change();
      this.options.persistence && (this.options.persistence.loginThrottle = Object.fromEntries(this.entries));
      try { await this.options.persist?.(); } catch (error) {
        this.entries.clear();
        for (const [key, value] of before) this.entries.set(key, value);
        this.options.persistence && (this.options.persistence.loginThrottle = Object.fromEntries(before));
        throw error;
      }
    });
    this.mutation = next.catch(() => undefined);
    await next;
  }
}

export class SessionStore {
  private readonly data: Required<PersistedAuth>;
  private mutation = Promise.resolve();

  constructor(private readonly secret: string, private readonly options: { persistence?: PersistedAuth; persist?: () => Promise<void> } = {}) {
    const persistence = options.persistence ?? {};
    persistence.challenges ??= {};
    persistence.sessions ??= {};
    this.data = persistence as Required<PersistedAuth>;
  }

  private async mutate<T>(operation: () => T): Promise<T> {
    let result!: T;
    const next = this.mutation.then(async () => {
      const prior = JSON.stringify(this.data);
      try {
        result = operation();
        await this.options.persist?.();
      } catch (error) {
        const restored = JSON.parse(prior) as Required<PersistedAuth>;
        this.data.challenges = restored.challenges;
        this.data.sessions = restored.sessions;
        throw error;
      }
    });
    this.mutation = next.catch(() => undefined);
    await next;
    return result;
  }

  async createChallenge(email: string, now = Date.now()): Promise<{ id: string; expiresAt: number }> {
    const id = randomUUID();
    const expiresAt = now + CHALLENGE_TTL_MS;
    return this.mutate(() => {
      this.data.challenges[digest(this.secret, id)] = { email: normalizedEmail(email), expiresAt, used: false };
      return { id, expiresAt };
    });
  }

  async consumeChallenge(id: string, now = Date.now()): Promise<{ email: string } | undefined> {
    return this.mutate(() => {
      const record = this.data.challenges[digest(this.secret, id)];
      if (!record || record.used || record.expiresAt <= now) return undefined;
      record.used = true;
      return { email: record.email };
    });
  }

  async createSession(email: string, now = Date.now()): Promise<string> {
    const id = randomUUID();
    const normalized = normalizedEmail(email);
    const idleDeadline = now + IDLE_TTL_MS;
    return this.mutate(() => {
      this.data.sessions[digest(this.secret, id)] = { email: normalized, idleDeadline, signature: digest(this.secret, `session:${id}:${normalized}:${idleDeadline}`) };
      return `${id}.${digest(this.secret, id)}`;
    });
  }

  async useSession(cookie: string, now = Date.now()): Promise<{ email: string } | undefined> {
    return this.mutate(() => {
      const [id, signature] = cookie.split(".");
      if (!id || !signature) return undefined;
      const expected = digest(this.secret, id);
      if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return undefined;
      const record = this.data.sessions[digest(this.secret, id)];
      if (!record || record.idleDeadline <= now || record.signature !== digest(this.secret, `session:${id}:${record.email}:${record.idleDeadline}`)) {
        delete this.data.sessions[digest(this.secret, id)];
        return undefined;
      }
      record.idleDeadline = now + IDLE_TTL_MS;
      record.signature = digest(this.secret, `session:${id}:${record.email}:${record.idleDeadline}`);
      return { email: record.email };
    });
  }

  async revokeSession(cookie: string): Promise<boolean> {
    return this.mutate(() => {
      const [id, signature] = cookie.split(".");
      if (!id || !signature) return false;
      const expected = digest(this.secret, id);
      if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
      const key = digest(this.secret, id);
      if (!this.data.sessions[key]) return false;
      delete this.data.sessions[key];
      return true;
    });
  }
}
