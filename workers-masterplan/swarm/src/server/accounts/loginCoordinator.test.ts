import { describe, expect, it, vi } from "vitest";

import { LoginCoordinator } from "./loginCoordinator.js";

const deviceChallenge = {
  accountId: "bot1/acc1" as const,
  loginId: "login-private-id",
  method: "device_code" as const,
  verificationUrl: "https://auth.example.test/device",
  userCode: "ABCD-EFGH",
  expiresAt: 0,
};

function fixture() {
  let clock = 1_000;
  const start = vi.fn(async () => ({ ...deviceChallenge }));
  const cancel = vi.fn(async () => undefined);
  const coordinator = new LoginCoordinator({ start, cancel, now: () => clock, fingerprintSalt: "test-only-salt" });
  return { coordinator, start, cancel, setClock: (value: number) => { clock = value; } };
}

describe("LoginCoordinator", () => {
  it("expires challenges after ten minutes and never serializes the device code or login ID", async () => {
    const { coordinator, start, setClock } = fixture();

    await expect(coordinator.start("bot1/acc1", "device_code")).resolves.toMatchObject({ expiresAt: 601_000, userCode: "ABCD-EFGH" });
    expect(start).toHaveBeenCalledWith("bot1/acc1", "device_code");
    expect(JSON.stringify(coordinator.challengeState("bot1/acc1"))).not.toMatch(/ABCD-EFGH|login-private-id/);
    expect(JSON.stringify(coordinator)).not.toMatch(/ABCD-EFGH|login-private-id/);

    setClock(601_000);
    expect(coordinator.expire()).toEqual(["bot1/acc1"]);
    expect(coordinator.challengeState("bot1/acc1")).toBeUndefined();
  });

  it("cancels an active challenge and rejects identity reuse while the first profile remains connected", async () => {
    const { coordinator, cancel } = fixture();
    await coordinator.start("bot1/acc1", "device_code");
    await coordinator.cancel("bot1/acc1");
    expect(cancel).toHaveBeenCalledWith("bot1/acc1", "login-private-id");

    await coordinator.start("bot1/acc1", "device_code");
    expect(coordinator.complete("bot1/acc1", { email: "person@example.test", workspace: "Personal", planType: "Pro" })).toEqual({ email: "person@example.test", workspace: "Personal", planType: "Pro" });
    await coordinator.start("bot1/acc2", "same_mac_browser");
    expect(() => coordinator.complete("bot1/acc2", { email: "person@example.test", workspace: "Personal", planType: "Pro" })).toThrow(expect.objectContaining({ code: "IDENTITY_ALREADY_CONNECTED" }));
    expect(coordinator.connectedAccount("bot1/acc1")).toBe(true);
  });

  it("re-reads the account after a login-completed notification instead of using notification data", async () => {
    const { coordinator } = fixture();
    const listeners = new Set<(event: { type: "account"; state?: string }) => void>();
    const readAccount = vi.fn(async () => ({ account: { email: "person@example.test", workspace: "Personal", planType: "Pro" }, requiresOpenaiAuth: false }));
    const stop = coordinator.bindAppServer("bot1/acc1", {
      onEvent(listener) { listeners.add(listener); return () => listeners.delete(listener); },
      readAccount,
    });
    await coordinator.start("bot1/acc1", "device_code");

    for (const listener of listeners) listener({ type: "account", state: "login_completed" });
    await vi.waitFor(() => expect(coordinator.connectedAccount("bot1/acc1")).toBe(true));
    expect(readAccount).toHaveBeenCalledOnce();
    stop();
  });

  it("re-registers authenticated profiles after restart and rejects a duplicate identity on reconnect", () => {
    const metadata = { id: "account-123", email: "person@example.test", workspace: "Personal", planType: "Pro" };
    const firstRuntime = fixture().coordinator;
    firstRuntime.registerConnectedIdentity("bot1/acc1", metadata);

    const restartedRuntime = fixture().coordinator;
    restartedRuntime.registerConnectedIdentity("bot1/acc1", metadata);

    expect(() => restartedRuntime.registerConnectedIdentity("bot1/acc2", metadata))
      .toThrow(expect.objectContaining({ code: "IDENTITY_ALREADY_CONNECTED" }));
    expect(restartedRuntime.connectedAccount("bot1/acc1")).toBe(true);
    expect(restartedRuntime.connectedAccount("bot1/acc2")).toBe(false);
  });

  it("reports a duplicate identity observed through an account update instead of swallowing it", async () => {
    const onFailure = vi.fn();
    const { start, cancel } = fixture();
    const coordinator = new LoginCoordinator({ start, cancel, fingerprintSalt: "test-only-salt", onFailure });
    const metadata = { id: "account-123", email: "person@example.test", workspace: "Personal", planType: "Pro" };
    coordinator.registerConnectedIdentity("bot1/acc1", metadata);
    const listeners = new Set<(event: { type: "account"; state?: string }) => void>();
    const stop = coordinator.bindAppServer("bot1/acc2", {
      onEvent(listener) { listeners.add(listener); return () => listeners.delete(listener); },
      readAccount: async () => ({ account: metadata }),
    });

    for (const listener of listeners) listener({ type: "account", state: "updated" });

    await vi.waitFor(() => expect(onFailure).toHaveBeenCalledWith("bot1/acc2", expect.objectContaining({ code: "IDENTITY_ALREADY_CONNECTED" })));
    expect(coordinator.connectedAccount("bot1/acc2")).toBe(false);
    stop();
  });
});
