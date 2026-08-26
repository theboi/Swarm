import { describe, expect, it, vi } from "vitest";
import type { AccountId } from "../../shared/contracts.js";
import { AccountManager } from "./accountManager.js";
import type { LaunchHandle, SuLauncher } from "./suLauncher.js";

const account = "bot1" as const;

function fixture() {
  const handle: LaunchHandle = { account, endpoint: "ws://127.0.0.1:42001", capabilityToken: "transient", stop: vi.fn(async () => undefined) };
  const launch = vi.fn(async () => handle);
  const launcher = { launch, shutdown: vi.fn(async () => undefined) } as unknown as SuLauncher;
  const client = { connect: vi.fn(async () => ({ account: { type: "chatgpt" }, requiresOpenaiAuth: false })), close: vi.fn(async () => undefined) };
  const createClient = vi.fn(() => client);
  const manager = new AccountManager({ launcher, createClient, codexBin: "/opt/homebrew/bin/codex" });
  return { manager, handle, launch, client, createClient };
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

  it("fails closed into action_required and stops the launcher when app-server authentication cannot complete", async () => {
    const { manager, handle, client } = fixture();
    client.connect.mockRejectedValueOnce(new Error("ACCOUNT_AUTH_REQUIRED"));

    await expect(manager.connect({ account, password: "bot-password" })).rejects.toThrow("ACCOUNT_AUTH_REQUIRED");
    expect(handle.stop).toHaveBeenCalledOnce();
    expect(manager.snapshot(account)).toEqual(expect.objectContaining({ connection: "action_required", authentication: "unauthenticated", errorCode: "ACCOUNT_AUTH_REQUIRED", terminalCommand: "/usr/bin/su - bot1 -c '/opt/homebrew/bin/codex login'" }));
  });

  it("closes the client and the process group when an account disconnects", async () => {
    const { manager, handle, client } = fixture();
    await manager.connect({ account, password: "bot-password" });

    await manager.disconnect(account);

    expect(client.close).toHaveBeenCalledOnce();
    expect(handle.stop).toHaveBeenCalledOnce();
    expect(manager.snapshot(account)).toMatchObject({ connection: "disconnected", authentication: "unknown" });
  });

  it("rejects any account outside bot1 through bot8 before requesting a password", async () => {
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

  it("allows the coordinator to merge normalized non-secret account status", () => {
    const { manager } = fixture();

    manager.updateSnapshot(account, { activeTurns: 2, rateLimits: [{ id: "primary", label: "Primary", usedPercent: 20, resetsAt: 1_800, updatedAt: 1_000 }] });

    expect(manager.snapshot(account)).toMatchObject({ activeTurns: 2, rateLimits: [{ id: "primary", usedPercent: 20 }] });
  });
});
