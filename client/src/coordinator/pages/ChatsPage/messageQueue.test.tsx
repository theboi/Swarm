import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { chatSnapshot } from "../../test/fixtures";
import type { CoordinatorApi } from "../../api";
import {
  enqueueMessage,
  removeMessage,
  retryMessage,
  useMessageQueue,
  useMessageQueueDelivery,
} from "./messageQueue";

beforeEach(() => {
  const entries = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
  });
  let held = false;
  vi.stubGlobal("navigator", {
    locks: {
      request: async (
        _name: string,
        _options: unknown,
        callback: (lock: object | null) => Promise<void>,
      ) => {
        if (held) return callback(null);
        held = true;
        try {
          await callback({});
        } finally {
          held = false;
        }
      },
    },
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const idle = { ...chatSnapshot, pendingApprovals: [] };
const settings = { permissionMode: "ask_for_approval" as const };

it("retains messages with an actionable error when secure browser delivery APIs are unavailable", async () => {
  vi.stubGlobal("navigator", {});
  vi.stubGlobal("crypto", {
    getRandomValues: (words: Uint32Array) => words.fill(42),
  });
  const startTurn = vi.fn();
  const view = renderHook(() => {
    useMessageQueueDelivery({
      snapshot: idle,
      activeTurnKeys: new Set(),
      limitExhaustedTurnKeys: new Set(),
      api: { startTurn },
      markTurnActive: vi.fn(),
      refresh: async () => {},
    });
    return useMessageQueue();
  });
  act(() => {
    enqueueMessage("bot3", "thread-1", "Keep this message", settings);
  });
  await waitFor(() =>
    expect(view.result.current[0]).toMatchObject({
      text: "Keep this message",
      state: "failed",
      error: expect.stringContaining("HTTPS"),
    }),
  );
  expect(startTurn).not.toHaveBeenCalled();
});

it("persists exact messages/settings independently of chat selection and supports removal", () => {
  const first = renderHook(() => useMessageQueue());
  let id = "";
  act(() => {
    id = enqueueMessage("bot3", "thread-1", "  Exact\n", settings);
  });
  expect(first.result.current[0]).toMatchObject({
    id,
    accountId: "bot3",
    threadId: "thread-1",
    text: "  Exact\n",
    settings,
  });
  first.unmount();
  const second = renderHook(() => useMessageQueue());
  expect(second.result.current).toHaveLength(1);
  act(() => removeMessage(id));
  expect(second.result.current).toHaveLength(0);
});

it("delivers FIFO one turn at a time and never duplicates an in-flight request", async () => {
  const startTurn = vi.fn<CoordinatorApi["startTurn"]>(async () => ({
    data: { turn: { id: "next-turn" } },
  }));
  const markTurnActive = vi.fn();
  const refresh = vi.fn(async () => {});
  const { rerender } = renderHook(
    ({ active }) =>
      useMessageQueueDelivery({
        snapshot: idle,
        activeTurnKeys: active,
        limitExhaustedTurnKeys: new Set(),
        api: { startTurn },
        markTurnActive,
        refresh,
      }),
    { initialProps: { active: new Set(["bot3\u0000thread-1"]) } },
  );
  let first = "";
  act(() => {
    first = enqueueMessage("bot3", "thread-1", "First", settings);
    enqueueMessage("bot3", "thread-1", "Second", settings);
  });
  expect(startTurn).not.toHaveBeenCalled();
  rerender({ active: new Set() });
  await waitFor(() => expect(startTurn).toHaveBeenCalledTimes(1));
  expect(startTurn).toHaveBeenLastCalledWith(
    "bot3",
    "thread-1",
    "First",
    settings,
    first,
  );
  rerender({ active: new Set() });
  expect(startTurn).toHaveBeenCalledTimes(1);
  rerender({ active: new Set(["bot3\u0000thread-1"]) });
  rerender({ active: new Set() });
  await waitFor(() => expect(startTurn).toHaveBeenCalledTimes(2));
  expect(startTurn.mock.calls[1][2]).toBe("Second");
});

it("retains a failed head without retry loops or sending later messages", async () => {
  const startTurn = vi
    .fn()
    .mockResolvedValueOnce({
      error: { code: "OFFLINE", message: "Disconnected" },
    })
    .mockResolvedValue({ data: {} });
  const view = renderHook(() => {
    useMessageQueueDelivery({
      snapshot: idle,
      activeTurnKeys: new Set(),
      limitExhaustedTurnKeys: new Set(),
      api: { startTurn },
      markTurnActive: () => {},
      refresh: async () => {},
    });
    return useMessageQueue();
  });
  let id = "";
  act(() => {
    id = enqueueMessage("bot3", "thread-1", "First", settings);
    enqueueMessage("bot3", "thread-1", "Second", settings);
  });
  await waitFor(() =>
    expect(view.result.current[0].error).toBe("Disconnected"),
  );
  expect(startTurn).toHaveBeenCalledTimes(1);
  act(() => retryMessage(id));
  await waitFor(() => expect(startTurn).toHaveBeenCalledTimes(2));
  expect(startTurn.mock.calls[1][4]).toBe(id);
});

it("keeps a sending head locked through rerenders and retains later messages until a response cycle", async () => {
  let accept!: (result: { data: unknown }) => void;
  const startTurn = vi.fn<CoordinatorApi["startTurn"]>(
    () =>
      new Promise((resolve) => {
        accept = resolve;
      }),
  );
  const view = renderHook(() => {
    useMessageQueueDelivery({
      snapshot: idle,
      activeTurnKeys: new Set(),
      limitExhaustedTurnKeys: new Set(),
      api: { startTurn },
      markTurnActive: () => {},
      refresh: async () => {},
    });
    return useMessageQueue();
  });
  let id = "";
  act(() => {
    id = enqueueMessage("bot3", "thread-1", "First", settings);
  });
  await waitFor(() => expect(view.result.current[0].state).toBe("sending"));
  act(() => {
    removeMessage(id);
    enqueueMessage("bot3", "thread-1", "Second", settings);
  });
  view.rerender();
  expect(view.result.current.map((entry) => entry.text)).toEqual([
    "First",
    "Second",
  ]);
  expect(startTurn).toHaveBeenCalledTimes(1);
  await act(async () => {
    accept({ data: {} });
  });
  expect(view.result.current.map((entry) => entry.text)).toEqual(["Second"]);
  expect(startTurn).toHaveBeenCalledTimes(1);
});

it("does not resurrect work when a terminal event arrives before the start acknowledgment", async () => {
  let accept!: (result: { data: unknown }) => void;
  const startTurn = vi
    .fn<CoordinatorApi["startTurn"]>()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          accept = resolve;
        }),
    )
    .mockResolvedValue({ data: { turn: { id: "second" } } });
  const markTurnActive = vi.fn();
  const view = renderHook(() =>
    useMessageQueueDelivery({
      snapshot: idle,
      activeTurnKeys: new Set(),
      limitExhaustedTurnKeys: new Set(),
      api: { startTurn },
      markTurnActive,
      refresh: async () => {},
      isTurnSettled: (_account, _thread, turn) => turn === "fast",
    }),
  );
  act(() => {
    enqueueMessage("bot3", "thread-1", "First", settings);
    enqueueMessage("bot3", "thread-1", "Second", settings);
  });
  await waitFor(() => expect(startTurn).toHaveBeenCalledTimes(1));
  await act(async () => {
    accept({ data: { turn: { id: "fast" } } });
  });
  await waitFor(() => expect(startTurn).toHaveBeenCalledTimes(2));
  expect(markTurnActive).not.toHaveBeenCalledWith("bot3", "thread-1", "fast");
  view.unmount();
});

it("releases the next message when completion skips an active render", async () => {
  let settled = false;
  const startTurn = vi.fn(async () => ({ data: { turn: { id: "fast" } } }));
  const view = renderHook(() =>
    useMessageQueueDelivery({
      snapshot: idle,
      activeTurnKeys: new Set(),
      limitExhaustedTurnKeys: new Set(),
      api: { startTurn },
      markTurnActive: vi.fn(),
      refresh: async () => {},
      isTurnSettled: () => settled,
    }),
  );
  act(() => {
    enqueueMessage("bot3", "thread-1", "First", settings);
    enqueueMessage("bot3", "thread-1", "Second", settings);
  });
  await waitFor(() => expect(startTurn).toHaveBeenCalledTimes(1));
  await act(async () => {});
  settled = true;
  view.rerender();
  await waitFor(() => expect(startTurn).toHaveBeenCalledTimes(2));
});

it.each(["approval", "limit", "sign-in", "missing", "active snapshot"])(
  "does not submit when blocked by %s",
  async (blocker) => {
    const startTurn = vi.fn(async () => ({ data: {} }));
    const snapshot =
      blocker === "approval"
        ? chatSnapshot
        : blocker === "sign-in"
          ? {
              ...idle,
              accounts: idle.accounts.map((a) => ({
                ...a,
                authentication: "unauthenticated" as const,
              })),
            }
          : blocker === "missing"
            ? { ...idle, threads: [] }
            : blocker === "active snapshot"
              ? {
                  ...idle,
                  threads: idle.threads.map((t) => ({
                    ...t,
                    activity: "active" as const,
                  })),
                }
              : idle;
    const view = renderHook(() => {
      useMessageQueueDelivery({
        snapshot,
        activeTurnKeys: new Set(),
        limitExhaustedTurnKeys: new Set(
          blocker === "limit" ? ["bot3\u0000thread-1"] : [],
        ),
        api: { startTurn },
        markTurnActive: () => {},
        refresh: async () => {},
      });
      return useMessageQueue();
    });
    act(() => {
      enqueueMessage("bot3", "thread-1", "Wait", settings);
    });
    await act(async () => {});
    expect(view.result.current).toHaveLength(1);
    expect(startTurn).not.toHaveBeenCalled();
  },
);
