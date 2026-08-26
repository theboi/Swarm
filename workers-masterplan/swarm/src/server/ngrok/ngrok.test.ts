import { describe, expect, it } from "vitest";
import { NgrokController, isNgrokWindowOpen, nextNgrokBoundary } from "./controller.js";

describe("ngrok window", () => {
  it.each([["2026-08-26T01:59:59.000Z", false], ["2026-08-26T02:00:00.000Z", true], ["2026-08-26T15:59:59.000Z", true], ["2026-08-26T16:00:00.000Z", false]])("applies 10:00 until midnight at %s", (iso, open) => expect(isNgrokWindowOpen(new Date(iso), "Asia/Singapore")).toBe(open));
  it("returns the next Singapore boundary", () => expect(nextNgrokBoundary(new Date("2026-08-26T02:00:00.000Z"), "Asia/Singapore").toISOString()).toBe("2026-08-26T16:00:00.000Z"));
  it("persists a manual early-stop suppression through restart", async () => {
    const persisted: { suppressUntil?: number } = {};
    const calls: string[] = [];
    const controller = new NgrokController({ timezone: "Asia/Singapore", persistence: persisted, start: async () => { calls.push("start"); return { id: "managed-1" }; }, stop: async () => { calls.push("stop"); } });
    await controller.reconcile(new Date("2026-08-26T03:00:00.000Z"));
    await controller.stopEarly(new Date("2026-08-26T03:00:00.000Z"));
    const restarted = new NgrokController({ timezone: "Asia/Singapore", persistence: persisted, start: async () => { calls.push("restart"); return { id: "managed-2" }; }, stop: async () => undefined });
    await restarted.reconcile(new Date("2026-08-26T04:00:00.000Z"));
    expect(calls).toEqual(["start", "stop"]);
  });

  it("serializes concurrent reconciliation and restarts after an unexpected managed-process exit", async () => {
    const calls: string[] = [];
    let healthy = false;
    const controller = new NgrokController({
      timezone: "Asia/Singapore",
      persistence: {},
      isHealthy: async () => healthy,
      start: async () => { calls.push("start"); healthy = true; return { id: "managed-1", publicUrl: "https://tunnel.ngrok.app/?token=secret" }; },
      stop: async () => { calls.push("stop"); healthy = false; },
    });
    await Promise.all([controller.reconcile(new Date("2026-08-26T03:00:00.000Z")), controller.reconcile(new Date("2026-08-26T03:00:00.000Z"))]);
    expect(calls).toEqual(["start"]);
    expect(controller.snapshot().publicUrl).toBe("https://tunnel.ngrok.app/");
    await controller.notifyProcessExit(new Date("2026-08-26T03:01:00.000Z"));
    expect(calls).toEqual(["start", "start"]);
  });

  it("discovers a healthy restart without spawning another tunnel and removes the URL at midnight", async () => {
    const persisted: { suppressUntil?: number; publicUrl?: string | null; managedTunnelId?: string | null } = { managedTunnelId: "managed-1", publicUrl: "https://known.ngrok.app" };
    let starts = 0;
    const controller = new NgrokController({
      timezone: "Asia/Singapore",
      persistence: persisted,
      discover: async () => ({ healthy: true, id: "managed-1", publicUrl: "https://known.ngrok.app" }),
      start: async () => { starts += 1; return { id: "managed-1" }; },
      stop: async () => undefined,
    });
    expect(controller.snapshot().publicUrl).toBe("https://known.ngrok.app/");
    await controller.reconcile(new Date("2026-08-26T03:00:00.000Z"));
    expect(starts).toBe(0);
    expect(controller.snapshot().publicUrl).toBe("https://known.ngrok.app/");
    await controller.reconcile(new Date("2026-08-26T16:00:00.000Z"));
    expect(controller.snapshot().publicUrl).toBeNull();
  });

  it("reconciles missed boundaries through its one-minute heartbeat", async () => {
    const scheduled: Array<() => void> = [];
    let now = new Date("2026-08-26T01:59:00.000Z");
    const calls: string[] = [];
    const controller = new NgrokController({
      timezone: "Asia/Singapore",
      persistence: {},
      clock: () => now,
      timer: { setEveryMinute: (callback) => { scheduled.push(callback); return 1; }, clear: () => undefined },
      start: async () => { calls.push("start"); return { id: "managed-1" }; },
      stop: async () => { calls.push("stop"); },
    });
    controller.startHeartbeat();
    now = new Date("2026-08-26T02:01:00.000Z");
    scheduled[0]!();
    await new Promise((resolve) => setImmediate(resolve));
    expect(calls).toEqual(["start"]);
    controller.stopHeartbeat();
  });

  it("does not claim or terminate a healthy tunnel it did not start", async () => {
    let stops = 0;
    const controller = new NgrokController({
      timezone: "Asia/Singapore",
      persistence: { managedTunnelId: "ours" },
      discover: async () => ({ healthy: true, id: "someone-else", publicUrl: "https://foreign.ngrok.app" }),
      start: async () => ({ id: "ours" }),
      stop: async () => { stops += 1; },
    });
    await controller.reconcile(new Date("2026-08-26T16:00:00.000Z"));
    expect(stops).toBe(0);
    expect(controller.snapshot(new Date("2026-08-26T16:00:00.000Z"))).toMatchObject({ state: "stopped", publicUrl: null });
  });

  it("stops its own tunnel during coordinator shutdown without creating an early-stop suppression", async () => {
    const persisted: { suppressUntil?: number } = {};
    let stops = 0;
    const controller = new NgrokController({ timezone: "Asia/Singapore", persistence: persisted, start: async () => ({ id: "managed" }), stop: async () => { stops += 1; } });
    await controller.reconcile(new Date("2026-08-26T03:00:00.000Z"));
    await controller.shutdown();

    expect(stops).toBe(1);
    expect(persisted.suppressUntil).toBeUndefined();
  });
});
