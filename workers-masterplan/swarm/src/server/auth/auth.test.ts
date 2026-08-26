import { describe, expect, it } from "vitest";
import { createPasswordHash, verifyPassword } from "./password.js";
import { createTotpVerifier, totpAt } from "./totp.js";
import { LoginThrottle, SessionStore, resolveLoginSource } from "./sessionStore.js";

describe("authentication primitives", () => {
  it("verifies a correct scrypt password without accepting a wrong password", async () => {
    const hash = await createPasswordHash("correct horse battery staple", "fixed-salt");
    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong", hash)).resolves.toBe(false);
  });

  it("accepts one adjacent TOTP step and rejects replay durably across restart", async () => {
    const persistence: Record<string, unknown> = {};
    const verifier = createTotpVerifier("JBSWY3DPEHPK3PXP", { persistence });
    const code = totpAt("JBSWY3DPEHPK3PXP", 1_800_000);
    await expect(verifier.verify(code, 1_830_000, "challenge-1")).resolves.toBe(true);
    await expect(verifier.verify(code, 1_830_000, "challenge-1")).resolves.toBe(false);
    await expect(createTotpVerifier("JBSWY3DPEHPK3PXP", { persistence }).verify(code, 1_830_000, "challenge-1")).resolves.toBe(false);
    await expect(createTotpVerifier("JBSWY3DPEHPK3PXP", { persistence }).verify(code, 1_830_000, "different-challenge")).resolves.toBe(false);
  });

  it("enforces independent normalized-email and source-address throttles durably", async () => {
    const persistence: Record<string, unknown> = {};
    const throttle = new LoginThrottle({ limit: 2, baseBackoffMs: 1_000, persistence });
    await throttle.recordFailure("Claudio@Example.com", "127.0.0.1", 0);
    await throttle.recordFailure("claudio@example.com", "127.0.0.1", 0);
    expect(throttle.check("claudio@example.com", "127.0.0.2", 0)).toEqual({ allowed: false, retryAt: 1_000 });
    expect(throttle.check("other@example.com", "127.0.0.1", 0)).toEqual({ allowed: false, retryAt: 1_000 });
    expect(throttle.check("other@example.com", "127.0.0.2", 0)).toEqual({ allowed: true });
    expect(new LoginThrottle({ persistence }).check("claudio@example.com", "127.0.0.2", 0)).toEqual({ allowed: false, retryAt: 1_000 });
  });

  it("caps exponential login backoff instead of overflowing into a permanent lockout", async () => {
    const throttle = new LoginThrottle({ limit: 1, baseBackoffMs: 1_000, maxBackoffMs: 60_000 });
    for (let attempt = 0; attempt < 200; attempt += 1) await throttle.recordFailure("claudio@example.com", "127.0.0.1", 0);
    expect(throttle.check("claudio@example.com", "127.0.0.1", 0)).toEqual({ allowed: false, retryAt: 60_000 });
  });

  it("trusts forwarded source addresses only from a loopback managed proxy", () => {
    expect(resolveLoginSource({ directAddress: "10.0.0.4", forwardedFor: "198.51.100.8", trustManagedProxy: true })).toBe("10.0.0.4");
    expect(resolveLoginSource({ directAddress: "127.0.0.1", forwardedFor: "198.51.100.8", trustManagedProxy: false })).toBe("127.0.0.1");
    expect(resolveLoginSource({ directAddress: "::1", forwardedFor: "198.51.100.8, 10.0.0.1", trustManagedProxy: true })).toBe("198.51.100.8");
  });

  it("makes password challenges atomically single-use and expiring", async () => {
    const sessions = new SessionStore("session-secret");
    const challenge = await sessions.createChallenge("claudio@example.com", 0);
    const consumed = await Promise.all([sessions.consumeChallenge(challenge.id, 1_000), sessions.consumeChallenge(challenge.id, 1_000)]);
    expect(consumed.filter(Boolean)).toHaveLength(1);
    const expiring = await sessions.createChallenge("claudio@example.com", 0);
    await expect(sessions.consumeChallenge(expiring.id, 301_000)).resolves.toBeUndefined();
  });

  it("persists signed sessions across restart, atomically renews idle expiry, and expires after twelve idle hours", async () => {
    const persisted: Record<string, unknown> = {};
    let writes = 0;
    const first = new SessionStore("session-secret", { persistence: persisted, persist: async () => { writes += 1; } });
    const cookie = await first.createSession("claudio@example.com", 0);
    const restarted = new SessionStore("session-secret", { persistence: persisted });
    expect((await restarted.useSession(cookie, 1000))?.email).toBe("claudio@example.com");
    expect(await restarted.useSession(cookie, 12 * 60 * 60 * 1_000 + 1_001)).toBeUndefined();
    expect(writes).toBeGreaterThan(0);
  });

  it("rejects a tampered durable session record", async () => {
    const persisted: Record<string, unknown> = {};
    const store = new SessionStore("session-secret", { persistence: persisted });
    const cookie = await store.createSession("claudio@example.com", 0);
    const sessions = persisted.sessions as Record<string, { email: string }>;
    Object.values(sessions)[0]!.email = "attacker@example.com";
    await expect(new SessionStore("session-secret", { persistence: persisted }).useSession(cookie, 1)).resolves.toBeUndefined();
  });

  it("recovers auth mutation queues after a persistence failure", async () => {
    let first = true;
    const persistence: Record<string, unknown> = {};
    const verifier = createTotpVerifier("JBSWY3DPEHPK3PXP", { persistence, persist: async () => {
      if (first) { first = false; throw new Error("disk full"); }
    } });
    const code = totpAt("JBSWY3DPEHPK3PXP", 1_800_000);
    await expect(verifier.verify(code, 1_800_000, "challenge")).rejects.toThrow("disk full");
    await expect(verifier.verify(code, 1_800_000, "challenge")).resolves.toBe(true);
  });
});
