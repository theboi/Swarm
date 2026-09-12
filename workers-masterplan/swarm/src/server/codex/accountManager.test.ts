import { describe, expect, it, vi } from "vitest";
import type { AccountId, RateLimitWindow } from "../../shared/contracts.js";
import { AccountManager } from "./accountManager.js";
import type { LaunchHandle, SuLauncher } from "./suLauncher.js";

const account = "bot1" as const;

function fixture(selectedAccount: AccountId = account, onRateLimitReadError?: (account: AccountId, error: unknown) => void, now?: () => number) {
  const handle: LaunchHandle = { account: selectedAccount, endpoint: "ws://127.0.0.1:42001", capabilityToken: "transient", stop: vi.fn(async () => undefined) };
  const launch = vi.fn(async () => handle);
  const openTerminal = vi.fn(async () => undefined);
  const openLoginTerminal = vi.fn(async () => undefined);
  const launcher = { launch, openTerminal, openLoginTerminal, shutdown: vi.fn(async () => undefined) } as unknown as SuLauncher;
  const client = { connect: vi.fn(async () => ({ account: { type: "chatgpt" }, requiresOpenaiAuth: false })), isConnected: vi.fn(() => true), readRateLimitWindows: vi.fn<() => Promise<RateLimitWindow[]>>(async () => []), close: vi.fn(async () => undefined) };
  const createClient = vi.fn(() => client);
  const credentialVersion = vi.fn<() => Promise<string | undefined>>(async () => "credential-v1");
  const manager = new AccountManager({ launcher, createClient, codexBin: "/opt/homebrew/bin/codex", onRateLimitReadError, credentialVersion, now });
  return { manager, handle, launch, openTerminal, openLoginTerminal, client, createClient, credentialVersion };
}

describe("AccountManager", () => {
  it("maintains one ready app-server client per macOS account", async () => {
    const { manager, launch, client, createClient } = fixture();

    await expect(manager.connect({ account, password: "bot-password" })).resolves.toMatchObject({ id: account, connection: "connected", authentication: "authenticated" });
    await manager.connect({ account, password: "bot-password" });

    expect(launch).toHaveBeenCalledOnce();
    expect(createClient).toHaveBeenCalledOnce();
    expect(client.connect).toHaveBeenCalledOnce();
  });

  it("replaces a disconnected app-server client before reusing its account", async () => {
    const { manager, launch, client, handle } = fixture();
    await manager.connect({ account, password: "bot-password" });
    client.isConnected.mockReturnValue(false);

    await manager.connect({ account, password: "bot-password" });

    expect(handle.stop).toHaveBeenCalledOnce();
    expect(launch).toHaveBeenCalledTimes(2);
    expect(client.connect).toHaveBeenCalledTimes(2);
    expect(manager.snapshot(account)).toMatchObject({ connection: "connected", authentication: "authenticated" });
  });

  it("connects claudiothe first-class without a SWARM_USER password", async () => {
    const { manager, launch } = fixture("claudiothe");

    await expect(manager.connect({ account: "claudiothe" })).resolves.toMatchObject({ id: "claudiothe", connection: "connected", authentication: "authenticated" });

    expect(launch).toHaveBeenCalledWith({ account: "claudiothe", password: undefined, codexBin: "/opt/homebrew/bin/codex" });
    expect(manager.snapshotsList().map((snapshot) => snapshot.id)).toEqual(["claudiothe", "bot1", "bot2", "bot3", "bot4", "bot5", "bot6", "bot7", "bot8"]);
  });

  it("populates usage windows as part of a successful account connection", async () => {
    const { manager, client } = fixture();
    client.readRateLimitWindows.mockResolvedValueOnce([
      { id: "codex:primary", label: "Codex five-hour", usedPercent: 20, resetsAt: 1_800, updatedAt: 1_000 },
      { id: "codex:secondary", label: "Codex weekly", usedPercent: 70, resetsAt: 7_200, updatedAt: 1_000 },
    ]);

    await manager.connect({ account, password: "bot-password" });

    expect(manager.snapshot(account).rateLimits).toEqual([
      { id: "codex:primary", label: "Codex five-hour", usedPercent: 20, resetsAt: 1_800, updatedAt: 1_000 },
      { id: "codex:secondary", label: "Codex weekly", usedPercent: 70, resetsAt: 7_200, updatedAt: 1_000 },
    ]);
  });

  it("uses a successful usage read as the authentication authority when app-server status requests OpenAI auth", async () => {
    const { manager, client } = fixture();
    client.connect.mockResolvedValueOnce({ account: { type: "chatgpt" }, requiresOpenaiAuth: true });
    client.readRateLimitWindows.mockResolvedValueOnce([
      { id: "codex:primary", label: "Codex five-hour", usedPercent: 20, resetsAt: 1_800, updatedAt: 1_000 },
    ]);

    await expect(manager.connect({ account, password: "bot-password" })).resolves.toMatchObject({
      connection: "connected",
      authentication: "authenticated",
      rateLimits: [{ id: "codex:primary", usedPercent: 20 }],
    });
  });

  it("keeps an authenticated account connected when its initial usage read fails and reports the diagnostic", async () => {
    const report = vi.fn();
    const { manager, client } = fixture(account, report);
    client.readRateLimitWindows.mockRejectedValueOnce(new Error("usage unavailable"));

    await manager.connect({ account, password: "bot-password" });

    expect(manager.snapshot(account)).toMatchObject({ connection: "connected", authentication: "authenticated", rateLimits: [] });
    expect(report).toHaveBeenCalledWith(account, expect.objectContaining({ message: "usage unavailable" }));
  });

  it("quarantines an app-server after its Codex token expires while preserving the process and prior usage", async () => {
    const { manager, handle, client } = fixture();
    manager.updateSnapshot(account, { rateLimits: [{ id: "codex:primary", label: "Codex five-hour", usedPercent: 25, resetsAt: 1_800, updatedAt: 1_000 }] });
    client.connect.mockResolvedValueOnce({ account: { type: "chatgpt" }, requiresOpenaiAuth: false });
    client.readRateLimitWindows.mockRejectedValueOnce(new Error("usage request failed: 401 Unauthorized; token_expired"));

    await expect(manager.connect({ account, password: "bot-password" })).resolves.toMatchObject({
      connection: "action_required",
      authentication: "unauthenticated",
      errorCode: "ACCOUNT_AUTH_REQUIRED",
      rateLimits: [{ id: "codex:primary", usedPercent: 25 }],
    });

    expect(handle.stop).not.toHaveBeenCalled();
    expect(manager.client(account)).toBeUndefined();
  });

  it("keeps chat connected when account/read succeeds but the read-only usage probe fails", async () => {
    const { manager, handle, client } = fixture();
    client.connect.mockResolvedValueOnce({ account: { type: "chatgpt" }, requiresOpenaiAuth: true });
    client.readRateLimitWindows.mockRejectedValueOnce(new Error("OpenAI authentication required"));

    await expect(manager.connect({ account, password: "bot-password" })).resolves.toMatchObject({ connection: "connected", authentication: "authenticated", errorCode: "USAGE_UNAVAILABLE" });
    expect(client.readRateLimitWindows).toHaveBeenCalledOnce();
    expect(handle.stop).not.toHaveBeenCalled();
  });

  it("updates stale authentication after later usage failures and recovers after a successful probe", async () => {
    const { manager } = fixture();
    await manager.connect({ account, password: "bot-password" });

    manager.recordRateLimitReadFailure(account, new Error("GET /usage failed: 401 Unauthorized; code=token_expired"));
    expect(manager.snapshot(account)).toMatchObject({ connection: "action_required", authentication: "unauthenticated", errorCode: "ACCOUNT_AUTH_REQUIRED" });

    manager.recordRateLimitReadSuccess(account, [{ id: "codex:primary", label: "Codex five-hour", usedPercent: 5, resetsAt: 2_000, updatedAt: 1_500 }]);
    expect(manager.snapshot(account)).toMatchObject({ connection: "connected", authentication: "authenticated", errorCode: undefined, rateLimits: [{ id: "codex:primary", usedPercent: 5 }] });
  });

  it("replaces a connected app-server after its authentication expires", async () => {
    const { manager, launch, handle, client } = fixture();
    await manager.connect({ account, password: "bot-password" });
    manager.recordRateLimitReadFailure(account, new Error("401 Unauthorized; token_expired"));

    await manager.connect({ account, password: "bot-password" });

    expect(client.close).toHaveBeenCalledOnce();
    expect(handle.stop).toHaveBeenCalledOnce();
    expect(launch).toHaveBeenCalledTimes(2);
    expect(manager.snapshot(account)).toMatchObject({ connection: "connected", authentication: "authenticated" });
  });

  it("recovers an unauthenticated account only after its credential file changes", async () => {
    const { manager, launch, handle, client, credentialVersion } = fixture();
    await manager.connect({ account, password: "bot-password" });
    manager.recordRateLimitReadFailure(account, new Error("401 Unauthorized; token_revoked"));

    await manager.recoverChangedCredentials({ account, password: "bot-password" });
    expect(launch).toHaveBeenCalledOnce();
    expect(handle.stop).not.toHaveBeenCalled();

    credentialVersion.mockResolvedValue("credential-v2");
    await manager.recoverChangedCredentials({ account, password: "bot-password" });

    expect(client.close).toHaveBeenCalledOnce();
    expect(handle.stop).toHaveBeenCalledOnce();
    expect(launch).toHaveBeenCalledTimes(2);
    expect(manager.snapshot(account)).toMatchObject({ connection: "connected", authentication: "authenticated" });
  });

  it("forces an authentication recheck when the operator reloads unchanged credentials", async () => {
    const { manager, launch, client } = fixture();
    await manager.connect({ account, password: "bot-password" });
    manager.recordRateLimitReadFailure(account, new Error("401 Unauthorized; token_revoked"));

    await manager.recoverChangedCredentials({ account, password: "bot-password" }, { force: true });

    expect(client.close).toHaveBeenCalledOnce();
    expect(launch).toHaveBeenCalledTimes(2);
    expect(manager.snapshot(account)).toMatchObject({ connection: "connected", authentication: "authenticated" });
  });

  it("coalesces overlapping authentication recoveries into one replacement", async () => {
    let releaseOldClose!: () => void;
    const oldClose = new Promise<void>((resolve) => { releaseOldClose = resolve; });
    const handles = [1, 2, 3].map((index) => ({ account, endpoint: `ws://127.0.0.1:${42_000 + index}`, capabilityToken: `token-${index}`, stop: vi.fn(async () => undefined) }));
    const clients = [
      { connect: vi.fn(async () => ({ account: { type: "chatgpt" }, requiresOpenaiAuth: false })), isConnected: vi.fn(() => true), readRateLimitWindows: vi.fn(async () => []), close: vi.fn(() => oldClose) },
      { connect: vi.fn(async () => ({ account: { type: "chatgpt" }, requiresOpenaiAuth: false })), isConnected: vi.fn(() => true), readRateLimitWindows: vi.fn(async () => []), close: vi.fn(async () => undefined) },
      { connect: vi.fn(async () => ({ account: { type: "chatgpt" }, requiresOpenaiAuth: false })), isConnected: vi.fn(() => true), readRateLimitWindows: vi.fn(async () => []), close: vi.fn(async () => undefined) },
    ];
    let launchIndex = 0;
    const launch = vi.fn(async () => handles[launchIndex++]);
    const launcher = { launch, openTerminal: vi.fn(), openLoginTerminal: vi.fn(), shutdown: vi.fn() } as unknown as SuLauncher;
    let credential = "credential-v1";
    const manager = new AccountManager({ launcher, createClient: () => clients[launchIndex - 1], codexBin: "/opt/homebrew/bin/codex", credentialVersion: async () => credential });
    await manager.connect({ account, password: "bot-password" });
    manager.recordRateLimitReadFailure(account, new Error("401 Unauthorized; token_revoked"));
    credential = "credential-v2";

    const first = manager.recoverChangedCredentials({ account, password: "bot-password" });
    await vi.waitFor(() => expect(clients[0].close).toHaveBeenCalledOnce());
    const second = manager.recoverChangedCredentials({ account, password: "bot-password" });
    await Promise.resolve();

    expect(launch).toHaveBeenCalledOnce();
    releaseOldClose();
    await Promise.all([first, second]);

    expect(launch).toHaveBeenCalledTimes(2);
    expect(clients[1].close).not.toHaveBeenCalled();
  });

  it("backs off repeated automatic rechecks when credential metadata is unavailable", async () => {
    let clock = 1_000;
    const { manager, launch, client, credentialVersion } = fixture(account, undefined, () => clock);
    await manager.connect({ account, password: "bot-password" });
    manager.recordRateLimitReadFailure(account, new Error("401 Unauthorized; token_revoked"));
    credentialVersion.mockResolvedValue(undefined);
    client.connect.mockRejectedValueOnce(new Error("ACCOUNT_AUTH_REQUIRED"));

    clock += 30_000;
    await expect(manager.recoverChangedCredentials({ account, password: "bot-password" })).rejects.toThrow("ACCOUNT_AUTH_REQUIRED");
    await manager.recoverChangedCredentials({ account, password: "bot-password" });
    expect(launch).toHaveBeenCalledTimes(2);

    clock += 60_000;
    await manager.recoverChangedCredentials({ account, password: "bot-password" });
    expect(launch).toHaveBeenCalledTimes(3);
  });

  it("moves an initial authentication failure onto the bounded recovery schedule", async () => {
    let clock = 1_000;
    const { manager, launch, client } = fixture(account, undefined, () => clock);
    client.connect.mockRejectedValueOnce(new Error("ACCOUNT_AUTH_REQUIRED")).mockRejectedValueOnce(new Error("ACCOUNT_AUTH_REQUIRED"));

    await expect(manager.connect({ account, password: "bot-password" })).rejects.toThrow("ACCOUNT_AUTH_REQUIRED");
    await expect(manager.recoverChangedCredentials({ account, password: "bot-password" })).rejects.toThrow("ACCOUNT_AUTH_REQUIRED");
    await manager.recoverChangedCredentials({ account, password: "bot-password" });
    expect(launch).toHaveBeenCalledTimes(2);

    clock += 30_000;
    await manager.recoverChangedCredentials({ account, password: "bot-password" });
    expect(launch).toHaveBeenCalledTimes(3);
  });

  it("does not replace an active account process while a turn is still running", async () => {
    const { manager, launch, handle, credentialVersion } = fixture();
    await manager.connect({ account, password: "bot-password" });
    manager.recordRateLimitReadFailure(account, new Error("401 Unauthorized; token_revoked"));
    manager.updateSnapshot(account, { activeTurns: 1 });
    credentialVersion.mockResolvedValue("credential-v2");

    await manager.recoverChangedCredentials({ account, password: "bot-password" });

    expect(handle.stop).not.toHaveBeenCalled();
    expect(launch).toHaveBeenCalledOnce();
  });

  it("recognizes structured 401 and token-expired metadata regardless of message wording", async () => {
    const { manager } = fixture();
    await manager.connect({ account, password: "bot-password" });

    manager.recordRateLimitReadFailure(account, Object.assign(new Error("Unauthorized"), { code: 401, data: { code: "token_expired" } }));

    expect(manager.snapshot(account)).toMatchObject({ connection: "action_required", authentication: "unauthenticated", errorCode: "ACCOUNT_AUTH_REQUIRED" });
  });

  it("fails closed into action_required and stops the launcher when app-server authentication cannot complete", async () => {
    const { manager, handle, client } = fixture();
    client.connect.mockRejectedValueOnce(new Error("ACCOUNT_AUTH_REQUIRED"));

    await expect(manager.connect({ account, password: "bot-password" })).rejects.toThrow("ACCOUNT_AUTH_REQUIRED");
    expect(handle.stop).toHaveBeenCalledOnce();
    expect(manager.snapshot(account)).toEqual(expect.objectContaining({ connection: "action_required", authentication: "unauthenticated", errorCode: "ACCOUNT_AUTH_REQUIRED", terminalCommand: String.raw`exec /usr/bin/su - bot1 -c 'exec '\''/opt/homebrew/bin/codex'\'' login'` }));
  });

  it("closes the client and the process group when an account disconnects", async () => {
    const { manager, handle, client } = fixture();
    await manager.connect({ account, password: "bot-password" });

    await manager.disconnect(account);

    expect(client.close).toHaveBeenCalledOnce();
    expect(handle.stop).toHaveBeenCalledOnce();
    expect(manager.snapshot(account)).toMatchObject({ connection: "disconnected", authentication: "unknown" });
  });

  it("rejects unknown accounts before requesting a password", async () => {
    const { manager, launch } = fixture();

    await expect(manager.connect({ account: "bot9" as AccountId, password: "bot-password" })).rejects.toThrow(/allowlisted/i);
    expect(launch).not.toHaveBeenCalled();
  });

  it("exposes only a connected account client and emits normalized snapshot changes", async () => {
    const { manager, client } = fixture();
    const changes: string[] = [];
    const unsubscribe = manager.onChange((snapshot) => changes.push(snapshot.connection));

    expect(manager.client(account)).toBeUndefined();
    await manager.connect({ account, password: "bot-password" });

    expect(manager.client(account)).toBe(client);
    expect(changes).toEqual(["connecting", "connected"]);
    unsubscribe();
  });

  it("opens a Codex sign-in terminal before connection, then attaches the live console", async () => {
    const { manager, openTerminal, openLoginTerminal } = fixture();

    await (manager as unknown as { openTerminal(account: "bot1"): Promise<void> }).openTerminal(account);
    expect(openLoginTerminal).toHaveBeenCalledWith(account, "/opt/homebrew/bin/codex");
    await manager.connect({ account, password: "bot-password" });
    await (manager as unknown as { openTerminal(account: "bot1"): Promise<void> }).openTerminal(account);

    expect(openTerminal).toHaveBeenCalledWith(account);
  });

  it("opens the sign-in terminal instead of the app-server console after a token expires", async () => {
    const { manager, openTerminal, openLoginTerminal } = fixture();
    await manager.connect({ account, password: "bot-password" });
    manager.recordRateLimitReadFailure(account, new Error("token_expired"));

    await manager.openTerminal(account);

    expect(openLoginTerminal).toHaveBeenCalledWith(account, "/opt/homebrew/bin/codex");
    expect(openTerminal).not.toHaveBeenCalled();
  });

  it("allows the coordinator to merge normalized non-secret account status", () => {
    const { manager } = fixture();

    manager.updateSnapshot(account, { activeTurns: 2, rateLimits: [{ id: "primary", label: "Primary", usedPercent: 20, resetsAt: 1_800, updatedAt: 1_000 }] });

    expect(manager.snapshot(account)).toMatchObject({ activeTurns: 2, rateLimits: [{ id: "primary", usedPercent: 20 }] });
  });
});
