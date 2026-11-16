import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CoordinatorStoreProvider, useCoordinatorStore } from "./coordinatorStore.js";
import type { CoordinatorApi } from "../api.js";
import { snapshot } from "../test/fixtures.js";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it("does not reactivate a turn whose completion beat its HTTP acknowledgment", async () => {
  let socket: { onmessage?: (event: { data: string }) => void };
  class FakeSocket {
    onmessage?: (event: { data: string }) => void;
    constructor() { socket = this; }
    close() {}
    send() {}
  }
  vi.stubGlobal("WebSocket", FakeSocket);
  const api = { getSnapshot: async () => snapshot, refreshAllRateLimits: async () => ({ data: {} }) } as unknown as CoordinatorApi;
  function Probe() {
    const { activeTurnKeys, markTurnActive } = useCoordinatorStore();
    return <><button onClick={() => markTurnActive("bot3", "thread-1", "fast")}>Acknowledge</button><output>{JSON.stringify([...activeTurnKeys])}</output></>;
  }
  render(<CoordinatorStoreProvider api={api}><Probe /></CoordinatorStoreProvider>);
  await act(async () => { socket!.onmessage?.({ data: JSON.stringify({ sequence: 1, type: "turn", payload: { accountId: "bot3", threadId: "thread-1", turnId: "fast", state: "completed" } }) }); });
  fireEvent.click(screen.getByRole("button", { name: "Acknowledge" }));
  expect(screen.getByRole("status")).toHaveTextContent("[]");
});

it("batches event bursts by chat and invalidates the final transcript on completion", async () => {
  vi.useFakeTimers();
  let socket: FakeSocket;
  class FakeSocket {
    onmessage?: (event: { data: string }) => void;
    onclose?: () => void;
    onerror?: () => void;
    constructor() { socket = this; }
    close() {}
    send() {}
  }
  vi.stubGlobal("WebSocket", FakeSocket);
  const api = { getSnapshot: vi.fn(async () => snapshot), refreshAllRateLimits: async () => ({ data: {} }) } as unknown as CoordinatorApi;
  function Probe() {
    const { transcriptRevisions } = useCoordinatorStore();
    return <output>{JSON.stringify([...transcriptRevisions])}</output>;
  }
  render(<CoordinatorStoreProvider api={api}><Probe /></CoordinatorStoreProvider>);
  await act(async () => { await Promise.resolve(); });
  let sequence = 0;
  await act(async () => {
    for (let index = 0; index < 50; index++) socket!.onmessage?.({ data: JSON.stringify({ sequence: ++sequence, type: "transcript", payload: { accountId: "bot3", threadId: "thread-1" } }) });
    socket!.onmessage?.({ data: JSON.stringify({ sequence: ++sequence, type: "transcript", payload: { accountId: "bot3", threadId: "thread-2" } }) });
    await vi.advanceTimersByTimeAsync(250);
  });
  expect(JSON.parse(screen.getByRole("status").textContent!)).toEqual([["bot3\u0000thread-1", 1], ["bot3\u0000thread-2", 1]]);
  await act(async () => {
    socket!.onmessage?.({ data: JSON.stringify({ sequence: ++sequence, type: "turn", payload: { accountId: "bot3", threadId: "thread-1", turnId: "turn-1", state: "completed" } }) });
    await vi.advanceTimersByTimeAsync(250);
  });
  expect(JSON.parse(screen.getByRole("status").textContent!)).toEqual([["bot3\u0000thread-1", 2], ["bot3\u0000thread-2", 1]]);
});
