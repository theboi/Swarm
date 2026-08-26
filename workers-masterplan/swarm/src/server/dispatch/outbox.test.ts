import { describe, expect, it } from "vitest";
import { DispatchOutbox } from "./outbox.js";

describe("DispatchOutbox", () => {
  it("never retries recovered submitting work without a matching stable client message", async () => {
    const outbox = new DispatchOutbox([{ id: "d1", clientUserMessageId: "m1", taskId: "T0", accountId: "bot3", threadId: "t1", state: "submitting", createdAt: 0, updatedAt: 0, retryAt: null }]);
    await outbox.recover({ readThread: async () => ({ turns: [] }) });
    expect(outbox.get("d1")?.state).toBe("attention_required");
  });
  it("recognizes recovered accepted work and persists queued before send", async () => {
    const outbox = new DispatchOutbox([{ id: "d1", clientUserMessageId: "m1", taskId: "T0", accountId: "bot3", threadId: "t1", state: "submitting", createdAt: 0, updatedAt: 0, retryAt: null }]);
    await outbox.recover({ readThread: async () => ({ turns: [{ clientUserMessageId: "m1" }] }) });
    expect(outbox.get("d1")?.state).toBe("accepted");
  });

  it("flushes queued and submitting states before exactly one turn send", async () => {
    const states: string[][] = [];
    const outbox = new DispatchOutbox([], async (records) => { states.push(records.map((record) => record.state)); });
    await outbox.dispatch({ id: "d1", clientUserMessageId: "m1", taskId: "T0", accountId: "bot3", threadId: "t1", state: "queued", createdAt: 0, updatedAt: 0, retryAt: null }, { startTurn: async () => undefined });
    expect(states).toEqual([["queued"], ["submitting"], ["accepted"]]);
  });

  it("rejects redispatching an existing ID before a second turn can start", async () => {
    let starts = 0;
    const outbox = new DispatchOutbox();
    const record = { id: "d1", clientUserMessageId: "m1", taskId: "T0", accountId: "bot3" as const, threadId: "t1", state: "queued" as const, createdAt: 0, updatedAt: 0, retryAt: null };
    await outbox.dispatch(record, { startTurn: async () => { starts += 1; } });
    await expect(outbox.dispatch(record, { startTurn: async () => { starts += 1; } })).rejects.toThrow("already exists");
    expect(starts).toBe(1);
  });

  it("rejects a second dispatch that reuses a stable client message ID", async () => {
    let starts = 0;
    const outbox = new DispatchOutbox();
    const first = { id: "d1", clientUserMessageId: "m1", taskId: "T0", accountId: "bot3" as const, threadId: "t1", state: "queued" as const, createdAt: 0, updatedAt: 0, retryAt: null };
    await outbox.dispatch(first, { startTurn: async () => { starts += 1; } });
    await expect(outbox.dispatch({ ...first, id: "d2" }, { startTurn: async () => { starts += 1; } })).rejects.toThrow("client message");
    expect(starts).toBe(1);
  });

  it("never reopens an accepted dispatch when rate-limit state arrives late", async () => {
    const outbox = new DispatchOutbox([{ id: "d1", clientUserMessageId: "m1", taskId: "T0", accountId: "bot3", threadId: "t1", state: "accepted", createdAt: 0, updatedAt: 0, retryAt: null }]);
    await expect(outbox.waitForLimit("d1", 1000, 0)).rejects.toThrow("Cannot transition");
  });

  it("requires includeTurns and sends ambiguous or unreadable recovered submissions to attention", async () => {
    const records = ["ambiguous", "unreadable"].map((id, index) => ({ id, clientUserMessageId: `m${index + 1}`, taskId: "T0", accountId: "bot3" as const, threadId: "t1", state: "submitting" as const, createdAt: 0, updatedAt: 0, retryAt: null }));
    const outbox = new DispatchOutbox(records);
    const calls: Array<{ includeTurns: boolean }> = [];
    await outbox.recover({ readThread: async (record, options) => {
      calls.push(options);
      if (record.id === "unreadable") throw new Error("socket closed");
      return { turns: [{ clientUserMessageId: "m1" }, { clientUserMessageId: "m1" }] };
    } });
    expect(calls).toEqual([{ includeTurns: true }, { includeTurns: true }]);
    expect(outbox.get("ambiguous")?.state).toBe("attention_required");
    expect(outbox.get("unreadable")?.state).toBe("attention_required");
  });

  it("does not send when persisting queued or submitting state fails", async () => {
    let starts = 0;
    const record = { id: "d1", clientUserMessageId: "m1", taskId: "T0", accountId: "bot3" as const, threadId: "t1", state: "queued" as const, createdAt: 0, updatedAt: 0, retryAt: null };
    const outbox = new DispatchOutbox([], async () => { throw new Error("disk full"); });
    await expect(outbox.dispatch(record, { startTurn: async () => { starts += 1; } })).rejects.toThrow("disk full");
    expect(starts).toBe(0);
  });

  it("rebuilds waiting-limit timers without dispatching them", async () => {
    const outbox = new DispatchOutbox([{ id: "d1", clientUserMessageId: "m1", taskId: "T0", accountId: "bot3", threadId: "t1", state: "waiting_for_limit", createdAt: 0, updatedAt: 0, retryAt: 1234 }]);
    expect(outbox.recoverWaitingTimers()).toEqual([{ id: "d1", retryAt: 1234 }]);
  });

  it("can complete or abandon an existing record without reminting its stable client id", async () => {
    const outbox = new DispatchOutbox([{ id: "d1", clientUserMessageId: "m1", taskId: "T0", accountId: "bot3", threadId: "t1", state: "accepted", createdAt: 0, updatedAt: 0, retryAt: null }]);

    await outbox.complete("d1", 10);
    expect(outbox.get("d1")).toMatchObject({ state: "completed", clientUserMessageId: "m1" });
    await outbox.abandon("d1", 11);

    expect(outbox.get("d1")?.state).toBe("attention_required");
  });

  it("settles only the accepted launch associated with a completed thread", async () => {
    const outbox = new DispatchOutbox([
      { id: "d1", clientUserMessageId: "m1", taskId: "T0", accountId: "bot3", threadId: "thread-1", state: "accepted", createdAt: 0, updatedAt: 0, retryAt: null },
      { id: "d2", clientUserMessageId: "m2", taskId: "T1", accountId: "bot3", threadId: "thread-2", state: "accepted", createdAt: 0, updatedAt: 0, retryAt: null },
    ]);

    await expect(outbox.completeAcceptedForThread("bot3", "thread-1", 10)).resolves.toMatchObject({ id: "d1", state: "accepted" });
    expect(outbox.get("d1")?.state).toBe("completed");
    expect(outbox.get("d2")?.state).toBe("accepted");
    await expect(outbox.completeAcceptedForThread("bot3", "thread-1", 11)).resolves.toBeUndefined();
  });
});
