import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatsPage } from "./ChatsPage";
import { hasActiveDescendant, subagentReferences } from "./ChatsPage/subagents";
import { normalizeExecutionSettings } from "../turnSettings";
import { chatSnapshot, chatTranscript, setViewport } from "../test/fixtures";
import type { TranscriptItem } from "../../shared/contracts";

afterEach(cleanup);

const api = {
  readTranscript: async () => ({ data: chatTranscript }),
  readMarkdown: async () => ({ data: { filename: "runbook.md", content: "# Runbook\n\n<script>window.evil = true</script>\n\nSafe coordinator instructions." } }),
  listModels: async () => ({ data: [{ model: "gpt-5.3-codex", displayName: "GPT-5.3 Codex", supportedEfforts: ["low", "medium", "high", "xhigh"], defaultEffort: "medium", serviceTiers: [{ id: "standard", name: "Standard" }, { id: "priority", name: "Fast" }], defaultServiceTier: "standard", isDefault: true }] }),
  listThreads: async (accountId: string) => ({ data: chatSnapshot.threads.filter((thread) => thread.accountId === accountId) }),
  startTurn: async () => ({ data: {} }),
  startThread: async () => ({ data: chatSnapshot.threads[1] }),
  renameThread: async () => ({ data: {} }),
  archiveThread: async () => ({ data: {} }),
  steerTurn: async () => ({ data: {} }),
  interruptTurn: async () => ({ data: {} }),
  decideApproval: async () => ({ data: {} }),
  setLimitResumeEnabled: async (_accountId: string, _threadId: string, enabled: boolean) => ({ data: { enabled } }),
};

describe("ChatsPage", () => {
  it("restores separate chat drafts after switching chats and leaving the page", async () => {
    const entries = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => { entries.set(key, value); },
      removeItem: (key: string) => { entries.delete(key); },
    });
    setViewport(1440);
    const user = userEvent.setup();
    const view = render(<ChatsPage snapshot={chatSnapshot} api={api} />);
    await user.type(screen.getByRole("textbox", { name: "Message" }), "First unsent message");
    await user.click(screen.getByRole("button", { name: /U1 · Coordinator UI/ }));
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue("");
    await user.type(screen.getByRole("textbox", { name: "Message" }), "Second unsent message");
    await user.click(screen.getByRole("button", { name: "T0 · Graph planning" }));
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue("First unsent message");
    view.unmount();
    render(<ChatsPage snapshot={chatSnapshot} api={api} />);
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue("First unsent message");
    await user.click(screen.getByRole("button", { name: /U1 · Coordinator UI/ }));
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue("Second unsent message");
    vi.unstubAllGlobals();
  });

  it("does not poll an idle chat but refreshes it when the tab becomes visible", async () => {
    vi.useFakeTimers();
    const readTranscript = vi.fn(async () => ({ data: chatTranscript }));
    try {
      render(<ChatsPage snapshot={chatSnapshot} api={{ ...api, readTranscript }} />);
      await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
      expect(readTranscript).toHaveBeenCalledTimes(1);
      await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
      expect(readTranscript).toHaveBeenCalledTimes(2);
    } finally { vi.useRealTimers(); }
  });

  it("ignores transcript revisions from other chats", async () => {
    const readTranscript = vi.fn(async () => ({ data: chatTranscript }));
    const chatApi = { ...api, readTranscript };
    const view = render(<ChatsPage snapshot={chatSnapshot} api={chatApi} transcriptRevisions={new Map()} />);
    await screen.findByText("I found the coordinator runbook.");
    view.rerender(<ChatsPage snapshot={chatSnapshot} api={chatApi} transcriptRevisions={new Map([["bot3\u0000other-chat", 1]])} />);
    expect(readTranscript).toHaveBeenCalledTimes(1);
    view.rerender(<ChatsPage snapshot={chatSnapshot} api={chatApi} transcriptRevisions={new Map([["bot3\u0000thread-1", 1]])} />);
    await waitFor(() => expect(readTranscript).toHaveBeenCalledTimes(2));
  });

  it("shows automatic resume off by default and lets the user enable it", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    const setLimitResumeEnabled = vi.fn(async () => ({ data: { enabled: true } }));
    render(<ChatsPage snapshot={{ ...chatSnapshot, limitResumes: [] }} api={{ ...api, setLimitResumeEnabled }} />);

    const toggle = screen.getByRole("button", { name: "Enable automatic resume" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.click(toggle);
    expect(setLimitResumeEnabled).toHaveBeenCalledWith("bot3", "thread-1", true);
  });

  it("shows automatic resume enabled for an armed chat", () => {
    setViewport(1440);
    render(<ChatsPage snapshot={{ ...chatSnapshot, limitResumes: [{ accountId: "bot3" as const, threadId: "thread-1", state: "armed" as const, updatedAt: 2 }] }} api={api} />);

    expect(screen.getByRole("button", { name: "Disable automatic resume" })).toHaveAttribute("aria-pressed", "true");
  });

  it("derives descendant activity from subagent lifecycle events", () => {
    const base = { accountId: "bot3" as const, threadId: "parent", turnId: "turn-1", type: "subAgentActivity" as const, status: "completed" as const, createdAt: 1 };
    const started = { ...base, id: "started", payload: { kind: "started", agentThreadId: "child", agentPath: "review" } };
    const completed = { ...base, id: "completed", createdAt: 2, payload: { kind: "completed", agentThreadId: "child", agentPath: "review" } };

    expect(subagentReferences([started], "parent")).toEqual([{ threadId: "child", label: "review", active: true }]);
    expect(subagentReferences([started, completed], "parent")).toEqual([{ threadId: "child", label: "review", active: false }]);
  });

  it("propagates a running grandchild through the cached subagent graph", () => {
    const graph = new Map([
      ["parent", [{ threadId: "child", label: "child", active: false }]],
      ["child", [{ threadId: "grandchild", label: "grandchild", active: false }]],
    ]);

    expect(hasActiveDescendant("parent", "bot3", graph, new Set(["bot3\u0000grandchild"]))).toBe(true);
    expect(hasActiveDescendant("parent", "bot3", new Map([["parent", [{ threadId: "child", label: "child", active: true }]]]), new Set())).toBe(false);
  });

  it("keeps a parent chat row working after navigation while its child is active", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    const parentTranscript: TranscriptItem[] = [{ id: "child-start", accountId: "bot3", threadId: "thread-1", turnId: "turn-1", type: "subAgentActivity", status: "completed", createdAt: 1, payload: { kind: "started", agentThreadId: "child-thread", agentPath: "review" } }];
    const readTranscript = vi.fn(async (_accountId: string, requestedThreadId: string) => ({ data: requestedThreadId === "thread-1" ? parentTranscript : [] }));
    render(<ChatsPage snapshot={chatSnapshot} api={{ ...api, readTranscript }} activeTurnKeys={new Set(["bot3\u0000child-thread"])} />);

    await screen.findByRole("button", { name: "Open subagent review" });
    await user.click(screen.getByRole("button", { name: /U1 · Coordinator UI/ }));

    const parentRow = screen.getByRole("button", { name: "T0 · Graph planning" });
    expect(within(parentRow).getByText("Thinking")).toBeVisible();
    expect(within(parentRow).getByRole("img", { name: "T0 · Graph planning working" })).toBeVisible();
  });

  it("does not keep an idle parent thinking from a stale child-start transcript event", async () => {
    setViewport(1440);
    const staleTranscript: TranscriptItem[] = [{ id: "child-start", accountId: "bot3", threadId: "thread-1", turnId: "turn-old", type: "subAgentActivity", status: "completed", createdAt: 1, payload: { kind: "interacted", agentThreadId: "child-thread", agentPath: "review" } }];
    const readTranscript = vi.fn(async () => ({ data: staleTranscript }));

    render(<ChatsPage snapshot={chatSnapshot} api={{ ...api, readTranscript }} activeTurnKeys={new Set()} />);

    await screen.findByRole("button", { name: "Open subagent review" });
    expect(screen.queryByLabelText("Codex is thinking")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("review working")).not.toBeInTheDocument();
  });

  it("shows the subagent spinner from live child thread activity after reload", async () => {
    setViewport(1440);
    const parentTranscript: TranscriptItem[] = [{ id: "child-start", accountId: "bot3", threadId: "thread-1", turnId: "turn-live", type: "subAgentActivity", status: "completed", createdAt: 1, payload: { kind: "started", agentThreadId: "child-thread", agentPath: "review" } }];
    const childThread = { ...chatSnapshot.threads[0]!, id: "child-thread", name: "review", activity: "active" as const };
    const liveChildSnapshot = { ...chatSnapshot, threads: [...chatSnapshot.threads, childThread] };
    const readTranscript = vi.fn(async () => ({ data: parentTranscript }));

    const listThreads = vi.fn(async (accountId: string) => ({ data: liveChildSnapshot.threads.filter((thread) => thread.accountId === accountId) }));
    render(<ChatsPage snapshot={liveChildSnapshot} api={{ ...api, readTranscript, listThreads }} activeTurnKeys={new Set()} />);

    await screen.findByRole("button", { name: "Open subagent review" });
    expect(screen.getByLabelText("Codex is thinking")).toBeVisible();
    expect(within(screen.getByRole("navigation", { name: "Subagents" })).getByLabelText("review working")).toBeVisible();
  });

  it("presents chat navigation, conversation, and composer as a clear operator workflow", async () => {
    setViewport(1440);
    render(<ChatsPage snapshot={chatSnapshot} api={api} />);

    expect(screen.getByRole("complementary", { name: "Chats for bot3" })).toBeVisible();
    expect(screen.getByRole("region", { name: "T0 · Graph planning" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Message" })).toBeVisible();
    expect(screen.queryByText("Message Codex")).not.toBeInTheDocument();
    expect(screen.getByText("Turn options")).toBeVisible();
    expect(screen.getByLabelText("Model")).not.toBeVisible();
    expect(screen.getByRole("button", { name: "New chat" }).querySelector("svg")).not.toBeNull();
  });

  it("opens referenced subagents as compact pills with their own transcript and composer", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    const childTranscript: TranscriptItem[] = [
      { id: "child-agent", accountId: "bot3", threadId: "child-thread", turnId: "child-turn", type: "agentMessage", status: "completed", createdAt: 1_725_000_010, payload: { text: "Subagent findings are ready." } },
    ];
    const parentTranscript: TranscriptItem[] = [
      ...chatTranscript,
      { id: "child-spawn", accountId: "bot3", threadId: "thread-1", turnId: "turn-1", type: "subAgentActivity", status: "completed", createdAt: 1_725_000_009, payload: { kind: "spawned", agentThreadId: "child-thread", agentPath: "ui-review" } },
      { id: "child-tool", accountId: "bot3", threadId: "thread-1", turnId: "turn-1", type: "collabAgentToolCall", status: "completed", createdAt: 1_725_000_010, payload: { receiverThreadIds: ["child-thread"] } },
    ];
    const readTranscript = vi.fn(async (_accountId: string, requestedThreadId: string) => ({ data: requestedThreadId === "child-thread" ? childTranscript : parentTranscript }));
    const startTurn = vi.fn(async () => ({ data: { turn: { id: "child-next-turn" } } }));
    const markTurnActive = vi.fn();
    const view = render(<ChatsPage snapshot={chatSnapshot} api={{ ...api, readTranscript, startTurn }} activeTurnKeys={new Set(["bot3\u0000child-thread"])} markTurnActive={markTurnActive} />);

    const pill = await screen.findByRole("button", { name: "Open subagent ui-review" });
    expect(screen.getAllByRole("button", { name: "Open subagent ui-review" })).toHaveLength(1);
    expect(screen.getByLabelText("Codex is thinking")).toBeVisible();
    expect(screen.getByLabelText("bot3 working")).toBeVisible();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();

    view.rerender(<ChatsPage snapshot={chatSnapshot} api={{ ...api, readTranscript, startTurn }} activeTurnKeys={new Set()} markTurnActive={markTurnActive} />);
    await user.click(pill);

    const dialog = await screen.findByRole("dialog", { name: "Subagent ui-review" });
    expect(within(dialog).getByText("Subagent findings are ready.")).toBeVisible();
    await user.type(within(dialog).getByRole("textbox", { name: "Message" }), "Check the remaining states.");
    await user.click(within(dialog).getByRole("button", { name: "Send" }));

    expect(startTurn).toHaveBeenCalledWith("bot3", "child-thread", "Check the remaining states.", expect.objectContaining({ permissionMode: expect.any(String) }));
    expect(markTurnActive).toHaveBeenCalledWith("bot3", "child-thread", "child-next-turn");
  });

  it("groups chats by macOS account and toggles the selected bot3 picker only on a re-click", async () => {
    setViewport(390);
    const user = userEvent.setup();
    render(<ChatsPage snapshot={chatSnapshot} api={api} />);

    expect(screen.getByRole("button", { name: "bot3" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "T0 · Graph planning" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "bot3" }));
    expect(screen.getByRole("button", { name: "T0 · Graph planning" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "bot3" }));
    expect(screen.queryByRole("button", { name: "T0 · Graph planning" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "bot3" }));
    await user.click(screen.getByRole("button", { name: "T0 · Graph planning" }));
    expect(screen.queryByRole("button", { name: "T0 · Graph planning" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Rename chat" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "bot1" })).toBeVisible();
  });

  it("selects the owning account when Queued tasks opens a mapped chat", async () => {
    setViewport(390);
    render(<ChatsPage snapshot={chatSnapshot} api={api} initialThreadId="thread-3" />);

    expect(screen.getByRole("button", { name: "bot1" })).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByRole("heading", { name: "Account recovery" })).toBeVisible();
  });

  it("opens an account and its first chat when the account panel selects it", async () => {
    setViewport(1440);
    render(<ChatsPage snapshot={chatSnapshot} api={api} initialAccountId="bot1" />);

    expect(screen.getByRole("button", { name: "bot1" })).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByRole("heading", { name: "Account recovery" })).toBeVisible();
  });

  it("does not reselect the navigation account after the operator chooses another account", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    const { rerender } = render(<ChatsPage snapshot={chatSnapshot} api={api} initialAccountId="bot1" />);

    expect(await screen.findByRole("heading", { name: "Account recovery" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "bot3" }));
    expect(await screen.findByRole("heading", { name: "T0 · Graph planning" })).toBeVisible();

    rerender(<ChatsPage snapshot={{ ...chatSnapshot, generatedAt: chatSnapshot.generatedAt + 1, threads: [...chatSnapshot.threads] }} api={api} initialAccountId="bot1" />);

    expect(screen.getByRole("button", { name: "bot3" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "T0 · Graph planning" })).toBeVisible();
  });

  it("renders the chat workspace immediately and lazy-loads only the selected account's chat list", async () => {
    setViewport(1440);
    let resolveThreads: ((value: { data: typeof chatSnapshot.threads }) => void) | undefined;
    const listThreads = vi.fn(() => new Promise<{ data: typeof chatSnapshot.threads }>((resolve) => { resolveThreads = resolve; }));
    const lazySnapshot = { ...chatSnapshot, threads: [] };

    render(<ChatsPage snapshot={lazySnapshot} api={{ ...api, listThreads }} />);

    expect(screen.getByRole("region", { name: "Chats" })).toBeVisible();
    expect(screen.getByRole("status", { name: "Loading chats" })).toBeVisible();
    expect(listThreads).toHaveBeenCalledWith("bot3");
    resolveThreads?.({ data: chatSnapshot.threads.filter((thread) => thread.accountId === "bot3") });
    expect(await screen.findByRole("button", { name: "T0 · Graph planning" })).toBeVisible();
  });

  it("pins the selected account's overlaid five-hour and weekly usage below its chat list", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    render(<ChatsPage snapshot={chatSnapshot} api={api} />);

    const picker = screen.getByLabelText("Chats for bot3");
    expect(within(picker).getByLabelText("bot3: five-hour remaining 60%; weekly remaining 80%")).toBeVisible();
    expect(picker.lastElementChild).toHaveClass("thread-picker__usage");

    await user.click(screen.getByRole("button", { name: "bot1" }));
    expect(within(screen.getByLabelText("Chats for bot1")).getByLabelText("bot1: five-hour remaining unknown; weekly remaining unknown")).toBeVisible();
  });

  it("holds a newly launched account and chat target until the refreshed snapshot contains it", async () => {
    setViewport(390);
    render(<ChatsPage snapshot={chatSnapshot} api={api} initialTarget={{ accountId: "bot1", threadId: "thread-new" }} />);

    expect(screen.getByRole("button", { name: "bot1" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "No chat selected" })).toBeVisible();
  });

  it("shows a visible active-thinking indicator for a selected active turn", async () => {
    setViewport(1440);
    render(<ChatsPage snapshot={chatSnapshot} api={api} activeTurnKeys={new Set(["bot3\u0000thread-1"])} />);

    expect(screen.getByLabelText("Codex is thinking")).toBeVisible();
  });

  it("uses app-server thread activity when the browser missed the turn-start event", async () => {
    setViewport(1440);
    const activeSnapshot = { ...chatSnapshot, threads: chatSnapshot.threads.map((thread) => thread.id === "thread-1" ? { ...thread, activity: "active" as const } : thread) };
    render(<ChatsPage snapshot={activeSnapshot} api={api} activeTurnIds={new Map([["bot3\u0000thread-1", "turn-1"]])} />);

    expect(screen.getByLabelText("Codex is thinking")).toBeVisible();
    expect(screen.getByRole("button", { name: "Steer" })).toBeEnabled();
    expect(screen.getByText("Thinking", { selector: ".thread-picker__copy small" })).toBeVisible();
  });

  it("reconciles the local chat summary when a completed turn changes the coordinator snapshot to idle", async () => {
    setViewport(1440);
    const activeSnapshot = { ...chatSnapshot, threads: chatSnapshot.threads.map((thread) => thread.id === "thread-1" ? { ...thread, activity: "active" as const, activeTurnId: "turn-live" } : thread) };
    const idleSnapshot = { ...activeSnapshot, threads: activeSnapshot.threads.map((thread) => thread.id === "thread-1" ? { ...thread, activity: "idle" as const, activeTurnId: undefined } : thread) };
    const chatApi = { ...api, listThreads: async (accountId: string) => ({ data: activeSnapshot.threads.filter((thread) => thread.accountId === accountId) }) };
    const view = render(<ChatsPage snapshot={activeSnapshot} api={chatApi} />);
    await screen.findByLabelText("Codex is thinking");

    view.rerender(<ChatsPage snapshot={idleSnapshot} api={chatApi} />);

    await waitFor(() => expect(screen.queryByLabelText("Codex is thinking")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveAttribute("placeholder", "Write a message…");
  });

  it("steers an externally owned active turn using the turn ID recovered from its rollout", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    const steerTurn = vi.fn(async () => ({ data: {} }));
    const activeSnapshot = { ...chatSnapshot, threads: chatSnapshot.threads.map((thread) => thread.id === "thread-1" ? { ...thread, activity: "active" as const, activeTurnId: "turn-recovered" } : thread) };
    const listThreads = vi.fn(async (accountId: string) => ({ data: activeSnapshot.threads.filter((thread) => thread.accountId === accountId) }));
    render(<ChatsPage snapshot={activeSnapshot} api={{ ...api, listThreads, steerTurn }} />);

    await user.type(screen.getByRole("textbox", { name: "Message" }), "Use the correction I just sent.");
    expect(screen.getByRole("button", { name: "Steer" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Steer" }));

    expect(steerTurn).toHaveBeenCalledWith("bot3", "thread-1", "turn-recovered", "Use the correction I just sent.");
  });

  it("does not steer a historical turn when the active turn ID is unavailable", async () => {
    setViewport(1440);
    const steerTurn = vi.fn(async () => ({ data: {} }));
    const historicalTranscript: TranscriptItem[] = [
      { id: "completed-reply", accountId: "bot3", threadId: "thread-1", turnId: "completed-turn", type: "agentMessage", status: "completed", createdAt: 1_725_000_099, payload: { text: "This turn is already complete." } },
    ];
    const activeSnapshot = { ...chatSnapshot, threads: chatSnapshot.threads.map((thread) => thread.id === "thread-1" ? { ...thread, activity: "active" as const } : thread) };
    render(<ChatsPage snapshot={activeSnapshot} api={{ ...api, readTranscript: async () => ({ data: historicalTranscript }), steerTurn }} />);

    await screen.findByText("This turn is already complete.");
    expect(screen.getByRole("button", { name: "Steer" })).toBeDisabled();
    expect(steerTurn).not.toHaveBeenCalled();
  });

  it("shows an in-transcript working status while a selected turn is active", async () => {
    setViewport(1440);
    render(<ChatsPage snapshot={chatSnapshot} api={api} activeTurnKeys={new Set(["bot3\u0000thread-1"])} />);

    expect(screen.getByLabelText("Codex is working")).toHaveTextContent("Live updates will appear here");
  });

  it("keeps a live turn steerable instead of calling it read only", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    const steerTurn = vi.fn(async () => ({ data: {} }));
    render(<ChatsPage
      snapshot={chatSnapshot}
      api={{ ...api, steerTurn }}
      initialThreadId="thread-2"
      activeTurnKeys={new Set(["bot3\u0000thread-2"])}
      activeTurnIds={new Map([["bot3\u0000thread-2", "turn-live"]])}
    />);

    expect(await screen.findByLabelText("Codex is thinking")).toBeVisible();
    expect(screen.getByRole("button", { name: "Steer" })).toBeEnabled();
    expect(screen.getByText("Thinking", { selector: ".thread-picker__copy small" })).toBeVisible();
    await user.type(screen.getByRole("textbox", { name: "Message" }), "Use the new requirements.");
    await user.click(screen.getByRole("button", { name: "Steer" }));
    expect(steerTurn).toHaveBeenCalledWith("bot3", "thread-2", "turn-live", "Use the new requirements.");
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue("");
    expect(screen.queryByRole("status", { name: "Pending steer" })).not.toBeInTheDocument();
  });

  it("opens a rename overlay when the selected chat is clicked again", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    const renameThread = vi.fn(async () => ({ data: {} }));
    render(<ChatsPage snapshot={chatSnapshot} api={{ ...api, renameThread }} />);

    await user.click(screen.getByRole("button", { name: "T0 · Graph planning" }));
    const dialog = screen.getByRole("dialog", { name: "Rename chat" });
    await user.clear(within(dialog).getByRole("textbox", { name: "Chat name" }));
    await user.type(within(dialog).getByRole("textbox", { name: "Chat name" }), "Graph plan review");
    await user.click(within(dialog).getByRole("button", { name: "Rename" }));

    expect(renameThread).toHaveBeenCalledWith("bot3", "thread-1", "Graph plan review");
    expect(await screen.findByRole("heading", { name: "Graph plan review" })).toBeVisible();
  });

  it("marks an accepted turn as working before the realtime event arrives", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    const markTurnActive = vi.fn();
    render(<ChatsPage
      snapshot={chatSnapshot}
      api={{ ...api, startTurn: async () => ({ data: { turn: { id: "turn-immediate" } } }) }}
      {...({ markTurnActive } as object)}
    />);

    await user.type(screen.getByRole("textbox", { name: "Message" }), "Start the next task.");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(markTurnActive).toHaveBeenCalledWith("bot3", "thread-1", "turn-immediate");
  });

  it("refreshes an active chat transcript when a realtime event is missed", async () => {
    vi.useFakeTimers();
    const readTranscript = vi.fn(async () => ({ data: chatTranscript }));
    try {
      setViewport(1440);
      render(<ChatsPage snapshot={chatSnapshot} api={{ ...api, readTranscript }} activeTurnKeys={new Set(["bot3\u0000thread-1"])} />);
      expect(readTranscript).toHaveBeenCalledTimes(1);

      await act(async () => { await vi.advanceTimersByTimeAsync(2_500); });

      expect(readTranscript).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("serializes slow transcript polling so a large chat cannot be starved by refresh ticks", async () => {
    vi.useFakeTimers();
    let resolveFirst!: (value: { data: typeof chatTranscript }) => void;
    const firstRead = new Promise<{ data: typeof chatTranscript }>((resolve) => { resolveFirst = resolve; });
    const readTranscript = vi.fn()
      .mockImplementationOnce(() => firstRead)
      .mockResolvedValue({ data: chatTranscript });
    try {
      setViewport(1440);
      render(<ChatsPage snapshot={chatSnapshot} api={{ ...api, readTranscript }} activeTurnKeys={new Set(["bot3\u0000thread-1"])} />);
      expect(readTranscript).toHaveBeenCalledTimes(1);

      await act(async () => { await vi.advanceTimersByTimeAsync(7_500); });

      expect(readTranscript).toHaveBeenCalledTimes(1);
      await act(async () => { resolveFirst({ data: chatTranscript }); await Promise.resolve(); });
      expect(readTranscript).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a loaded transcript and silently recovers from a transient background read failure", async () => {
    const readTranscript = vi.fn()
      .mockResolvedValueOnce({ data: chatTranscript })
      .mockRejectedValueOnce(new Error("temporary app-server disconnect"))
      .mockResolvedValueOnce({ data: [...chatTranscript, { ...chatTranscript[1], id: "recovered-message", payload: { text: "Recovered reply" } }] });
    const chatApi = { ...api, readTranscript };
    const view = render(<ChatsPage snapshot={chatSnapshot} api={chatApi} transcriptRevision={0} />);
    expect(await screen.findByRole("article", { name: "agentMessage" })).toBeVisible();

    view.rerender(<ChatsPage snapshot={chatSnapshot} api={chatApi} transcriptRevision={1} />);
    await waitFor(() => expect(readTranscript).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("Unable to load this chat.")).not.toBeInTheDocument();
    expect(screen.getByRole("article", { name: "agentMessage" })).toBeVisible();

    view.rerender(<ChatsPage snapshot={chatSnapshot} api={chatApi} transcriptRevision={2} />);
    expect(await screen.findByText("Recovered reply")).toBeVisible();
  });

  it("reconciles an open chat even when cached activity incorrectly says idle", async () => {
    vi.useFakeTimers();
    const readTranscript = vi.fn(async () => ({ data: chatTranscript }));
    try {
      setViewport(1440);
      render(<ChatsPage snapshot={chatSnapshot} api={{ ...api, readTranscript }} />);
      expect(readTranscript).toHaveBeenCalledTimes(1);

      await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });

      expect(readTranscript).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("sends the selected model, effort, speed, and permission mode with the next turn", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    const startTurn = vi.fn(async () => ({ data: {} }));
    render(<ChatsPage snapshot={chatSnapshot} api={{ ...api, startTurn }} />);

    expect(screen.queryByLabelText("Model")).not.toBeVisible();
    await user.click(screen.getByText("Turn options"));
    await screen.findByRole("option", { name: "GPT-5.3 Codex" });
    await user.selectOptions(screen.getByLabelText("Model"), "gpt-5.3-codex");
    await user.selectOptions(screen.getByLabelText("Effort"), "high");
    await user.selectOptions(screen.getByLabelText("Speed"), "priority");
    await user.selectOptions(screen.getByLabelText("Permissions"), "full_access");
    await user.type(screen.getByRole("textbox", { name: "Message" }), "Run the release checks.");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(startTurn).toHaveBeenCalledWith("bot3", "thread-1", "Run the release checks.", {
      model: "gpt-5.3-codex",
      effort: "high",
      serviceTier: "priority",
      permissionMode: "full_access",
    });
  });

  it("normalizes stale saved options to the selected model's supported values", () => {
    const models = [{ model: "gpt-5.3-codex", displayName: "GPT-5.3 Codex", supportedEfforts: ["high"], defaultEffort: "high", serviceTiers: [{ id: "priority", name: "Fast" }], defaultServiceTier: "priority", isDefault: true }];
    expect(normalizeExecutionSettings(models, { model: "gpt-5.3-codex", effort: "unsupported", serviceTier: "unsupported", permissionMode: "full_access" })).toEqual({ model: "gpt-5.3-codex", effort: "high", serviceTier: "priority", permissionMode: "full_access" });
  });

  it("restores turn options for the same chat after the page is reopened", async () => {
    setViewport(1440);
    const entries = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => { entries.set(key, value); },
      removeItem: (key: string) => { entries.delete(key); },
    });
    const user = userEvent.setup();
    try {
      const first = render(<ChatsPage snapshot={chatSnapshot} api={api} />);
      await screen.findByRole("option", { name: "GPT-5.3 Codex" });
      await user.click(screen.getByText("Turn options"));
      await user.selectOptions(screen.getByLabelText("Effort"), "high");
      first.unmount();

      render(<ChatsPage snapshot={chatSnapshot} api={api} />);
      await screen.findByRole("option", { name: "GPT-5.3 Codex" });
      await user.click(screen.getByText("Turn options"));

      expect(screen.getByLabelText("Effort")).toHaveValue("high");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps per-chat turn options while the latest choice becomes the default for new chats", async () => {
    setViewport(1440);
    const entries = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => { entries.set(key, value); },
      removeItem: (key: string) => { entries.delete(key); },
    });
    const user = userEvent.setup();
    try {
      render(<ChatsPage snapshot={chatSnapshot} api={api} />);
      await screen.findByRole("option", { name: "GPT-5.3 Codex" });
      await user.click(screen.getByText("Turn options"));
      await user.selectOptions(screen.getByLabelText("Effort"), "high");

      await user.click(screen.getByRole("button", { name: "U1 · Coordinator UI" }));
      expect(screen.getByLabelText("Effort")).toHaveValue("high");
      await user.selectOptions(screen.getByLabelText("Effort"), "low");

      await user.click(screen.getByRole("button", { name: "T0 · Graph planning" }));
      expect(screen.getByLabelText("Effort")).toHaveValue("high");

      await user.click(screen.getByRole("button", { name: "New chat" }));
      expect(screen.getByLabelText("Effort")).toHaveValue("low");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("focuses the composer and scrolls an opened chat to its latest message", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    render(<ChatsPage snapshot={chatSnapshot} api={api} />);

    const transcript = screen.getByTestId("transcript-scroll");
    Object.defineProperty(transcript, "scrollHeight", { configurable: true, value: 1_000 });
    await user.click(screen.getByRole("button", { name: "U1 · Coordinator UI" }));

    await waitFor(() => expect(transcript.scrollTop).toBe(1_000));
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveFocus();
  });

  it("scrolls after the newly opened transcript has committed its rendered height", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    let resolveTranscript!: (value: { data: typeof chatTranscript }) => void;
    const readTranscript = vi.fn(() => new Promise<{ data: typeof chatTranscript }>((resolve) => { resolveTranscript = resolve; }));
    render(<ChatsPage snapshot={chatSnapshot} api={{ ...api, readTranscript }} />);

    const transcript = screen.getByTestId("transcript-scroll");
    Object.defineProperty(transcript, "scrollHeight", { configurable: true, get: () => transcript.childElementCount ? 1_240 : 0 });
    await act(async () => { resolveTranscript({ data: chatTranscript }); });

    await waitFor(() => expect(transcript.scrollTop).toBe(1_240));
  });

  it("offers direct jumps to the bottom and the latest message sent by the operator", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    render(<ChatsPage snapshot={chatSnapshot} api={api} />);

    const transcript = screen.getByTestId("transcript-scroll");
    Object.defineProperty(transcript, "scrollHeight", { configurable: true, value: 1_400 });
    transcript.scrollTop = 120;
    await user.click(screen.getByRole("button", { name: "Scroll to bottom" }));
    expect(transcript.scrollTop).toBe(1_400);

    const userMessages = await screen.findAllByRole("article", { name: "userMessage" });
    const latest = userMessages.at(-1)!;
    const scrollIntoView = vi.fn();
    latest.scrollIntoView = scrollIntoView;
    await user.click(screen.getByRole("button", { name: "Scroll to latest message you sent" }));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
  });

  it("does not force the transcript back to the bottom during live refreshes", async () => {
    setViewport(1440);
    const { rerender } = render(<ChatsPage snapshot={chatSnapshot} api={api} activeTurnKeys={new Set(["bot3\u0000thread-1"])} transcriptRevision={0} />);
    const transcript = screen.getByTestId("transcript-scroll");
    Object.defineProperty(transcript, "scrollHeight", { configurable: true, value: 1_000 });
    await waitFor(() => expect(transcript.scrollTop).toBe(1_000));
    transcript.scrollTop = 240;

    rerender(<ChatsPage snapshot={chatSnapshot} api={api} activeTurnKeys={new Set(["bot3\u0000thread-1"])} transcriptRevision={1} />);
    await waitFor(() => expect(api.readTranscript).toBeDefined());

    expect(transcript.scrollTop).toBe(240);
  });

  it("bounds the initial DOM for a very long chat and lets the operator reveal earlier messages", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    const longTranscript: TranscriptItem[] = Array.from({ length: 500 }, (_, index) => ({
      id: `message-${index}`,
      accountId: "bot3",
      threadId: "thread-1",
      turnId: `turn-${index}`,
      type: "agentMessage",
      status: "completed",
      createdAt: index,
      payload: { text: `Reply ${index}` },
    }));
    render(<ChatsPage snapshot={chatSnapshot} api={{ ...api, readTranscript: async () => ({ data: longTranscript }) }} />);

    await screen.findByText("Reply 499");
    expect(screen.queryByText("Reply 0")).not.toBeInTheDocument();
    expect(screen.getAllByRole("article", { name: "agentMessage" }).length).toBeLessThan(500);

    while (screen.queryByRole("button", { name: /earlier messages/i })) {
      await user.click(screen.getByRole("button", { name: /earlier messages/i }));
    }
    expect(screen.getByText("Reply 0")).toBeVisible();
    // Rendering all 500 Markdown messages in JSDOM is functional coverage, not a timing benchmark.
  }, 20_000);

  it("uses the conversation as the page surface and reports actions in a toast", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    render(<ChatsPage snapshot={chatSnapshot} api={api} />);

    expect(screen.queryByText("Multi-account workspace")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Chats", level: 1 })).not.toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Message" }), "Send this.");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("status")).toHaveClass("app-toast");
  });

  it("shows working spinners and pending-response dots on both account and chat rows", () => {
    setViewport(1440);
    render(
      <ChatsPage
        snapshot={chatSnapshot}
        api={api}
        activeTurnKeys={new Set(["bot3\u0000thread-1"])}
        attentionTurnKeys={new Set(["bot3\u0000thread-1"])}
      />,
    );

    expect(screen.getByLabelText("bot3 working")).toBeVisible();
    expect(screen.getByLabelText("bot3 needs attention")).toBeVisible();
    expect(screen.getByLabelText("T0 · Graph planning working")).toBeVisible();
    expect(screen.getByLabelText("T0 · Graph planning needs attention")).toBeVisible();
  });

  it("renders exact normalized transcript item categories and opens Markdown only from a transcript file link", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    render(<ChatsPage snapshot={chatSnapshot} api={api} />);

    for (const type of ["userMessage", "agentMessage", "plan", "reasoning", "commandExecution", "fileChange", "subAgentActivity", "opaque"]) {
      expect(await screen.findByRole("article", { name: type })).toBeVisible();
    }
    const transcript = screen.getByTestId("transcript-scroll");
    transcript.scrollTop = 144;
    await user.click(screen.getByRole("link", { name: "docs/runbook.md" }));
    const viewer = await screen.findByRole("dialog", { name: "runbook.md" });
    expect(viewer.querySelector("script")).toBeNull();
    expect(screen.getByRole("heading", { name: "Runbook" })).toBeVisible();
    expect(screen.queryByRole("tab", { name: /Markdown preview/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "runbook.md" })).not.toBeInTheDocument();
    expect(transcript.scrollTop).toBe(144);
  });

  it("opens a Markdown path supplied by the browser and clears it when the reader closes", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    const onOpenMarkdownPathChange = vi.fn();
    const readMarkdown = vi.fn(async () => ({ data: { filename: "runbook.md", content: "# Runbook" } }));
    render(<ChatsPage snapshot={chatSnapshot} api={{ ...api, readMarkdown }} openMarkdownPath="docs/runbook.md" onOpenMarkdownPathChange={onOpenMarkdownPathChange} />);

    expect(await screen.findByRole("dialog", { name: "runbook.md" })).toBeVisible();
    expect(readMarkdown).toHaveBeenCalledWith("bot3", "docs/runbook.md");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenMarkdownPathChange).toHaveBeenCalledWith(null);
  });

  it("closes an open Markdown reader when the browser removes its route path", async () => {
    setViewport(1440);
    const view = render(<ChatsPage snapshot={chatSnapshot} api={api} openMarkdownPath="docs/runbook.md" />);

    expect(await screen.findByRole("dialog", { name: "runbook.md" })).toBeVisible();
    view.rerender(<ChatsPage snapshot={chatSnapshot} api={api} openMarkdownPath={null} />);

    expect(screen.queryByRole("dialog", { name: "runbook.md" })).not.toBeInTheDocument();
  });

  it("ignores a Markdown read that finishes after the browser removes its route path", async () => {
    setViewport(1440);
    let resolveMarkdown!: (value: { data: { filename: string; content: string } }) => void;
    const readMarkdown = vi.fn(() => new Promise<{ data: { filename: string; content: string } }>((resolve) => { resolveMarkdown = resolve; }));
    const onOpenMarkdownPathChange = vi.fn();
    const view = render(<ChatsPage snapshot={chatSnapshot} api={{ ...api, readMarkdown }} openMarkdownPath="docs/runbook.md" onOpenMarkdownPathChange={onOpenMarkdownPathChange} />);

    await waitFor(() => expect(readMarkdown).toHaveBeenCalledWith("bot3", "docs/runbook.md"));
    view.rerender(<ChatsPage snapshot={chatSnapshot} api={{ ...api, readMarkdown }} openMarkdownPath={null} onOpenMarkdownPathChange={onOpenMarkdownPathChange} />);
    await act(async () => { resolveMarkdown({ data: { filename: "runbook.md", content: "# Runbook" } }); });

    expect(screen.queryByRole("dialog", { name: "runbook.md" })).not.toBeInTheDocument();
    expect(onOpenMarkdownPathChange).not.toHaveBeenCalled();
  });

  it("reopens a Markdown route through the account selected after the reader opens", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    const readMarkdown = vi.fn(async (accountId: string) => ({ data: { filename: "runbook.md", content: `# ${accountId} runbook` } }));
    render(<ChatsPage snapshot={chatSnapshot} api={{ ...api, readMarkdown }} openMarkdownPath="docs/runbook.md" />);

    expect(await screen.findByRole("heading", { name: "bot3 runbook" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "bot1" }));

    expect(await screen.findByRole("heading", { name: "bot1 runbook" })).toBeVisible();
    expect(readMarkdown).toHaveBeenCalledWith("bot1", "docs/runbook.md");
  });

  it("ignores a prior-account Markdown read after the account changes", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    let resolveBot3!: (value: { data: { filename: string; content: string } }) => void;
    const bot3Read = new Promise<{ data: { filename: string; content: string } }>((resolve) => { resolveBot3 = resolve; });
    const readMarkdown = vi.fn((accountId: string) => accountId === "bot3" ? bot3Read : Promise.resolve({ data: { filename: "runbook.md", content: "# bot1 runbook" } }));
    const onOpenMarkdownPathChange = vi.fn();
    render(<ChatsPage snapshot={chatSnapshot} api={{ ...api, readMarkdown }} openMarkdownPath="docs/runbook.md" onOpenMarkdownPathChange={onOpenMarkdownPathChange} />);

    await waitFor(() => expect(readMarkdown).toHaveBeenCalledWith("bot3", "docs/runbook.md"));
    await user.click(screen.getByRole("button", { name: "bot1" }));
    expect(await screen.findByRole("heading", { name: "bot1 runbook" })).toBeVisible();
    await act(async () => { resolveBot3({ data: { filename: "runbook.md", content: "# bot3 runbook" } }); });

    expect(screen.queryByRole("heading", { name: "bot3 runbook" })).not.toBeInTheDocument();
    expect(onOpenMarkdownPathChange).toHaveBeenCalledTimes(1);
  });

  it("opens a local blank draft from the top of the chat list and creates the server chat only on first send", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    const startThread = vi.fn(async () => ({ data: { id: "draft-thread", accountId: "bot3" as const, name: null, archived: false, updatedAt: 1, capabilities: { canArchive: true, canInterrupt: false, canStartTurn: true, canSteer: false } } }));
    const startTurn = vi.fn(async () => ({ data: {} }));
    render(<ChatsPage snapshot={chatSnapshot} api={{ ...api, startThread, startTurn }} />);

    await user.click(screen.getByRole("button", { name: "New chat" }));
    expect(screen.getByRole("heading", { name: "New chat" })).toBeVisible();
    expect(startThread).not.toHaveBeenCalled();
    await user.type(screen.getByRole("textbox", { name: "Message" }), "Start this investigation.");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(startThread).toHaveBeenCalledWith("bot3");
    expect(startTurn).toHaveBeenCalledWith("bot3", "draft-thread", "Start this investigation.", expect.any(Object));
  });

  it("shows a session-limit wait state and starts a JSONL continuation on another signed-in account", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    const moveThreadToAccount = vi.fn(async () => ({ data: { id: "continuation", accountId: "bot1" as const, name: "(Handoff) T0 · Graph planning", archived: false, updatedAt: 1, capabilities: { canArchive: false, canInterrupt: true, canStartTurn: false, canSteer: true } } }));
    const continuationSnapshot = {
      ...chatSnapshot,
      accounts: chatSnapshot.accounts.map((account) => account.id === "bot1" ? { ...account, connection: "connected" as const, authentication: "authenticated" as const } : account),
      limitResumes: [{ accountId: "bot3" as const, threadId: "thread-1", state: "waiting_for_limit" as const, updatedAt: 2 }],
    };
    render(<ChatsPage snapshot={continuationSnapshot} api={{ ...api, moveThreadToAccount }} />);

    expect(screen.getByRole("status", { name: "Session limit reached" })).toHaveTextContent("Waiting for usage availability before resuming. Retrying automatically.");
    await user.click(screen.getByRole("button", { name: "Move to another account" }));
    const dialog = screen.getByRole("dialog", { name: "Move to another account" });
    expect(dialog).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Close" })).toHaveClass("overlay-close-button");
    expect(within(dialog).queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "bot1" }));
    await user.click(screen.getByRole("button", { name: "Move to bot1" }));

    expect(moveThreadToAccount).toHaveBeenCalledWith("bot3", "thread-1", "bot1", expect.objectContaining({ permissionMode: expect.any(String) }));
    expect(await screen.findByRole("heading", { name: "(Handoff) T0 · Graph planning" })).toBeVisible();
  });

  it("keeps the JSONL handoff action beside Archive when the source account is unauthenticated and not limit-blocked", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    const moveThreadToAccount = vi.fn(async () => ({ data: { id: "continuation", accountId: "bot1" as const, name: "(Handoff) T0 · Graph planning", archived: false, updatedAt: 1, capabilities: { canArchive: false, canInterrupt: true, canStartTurn: false, canSteer: true } } }));
    const sourceUnauthenticated = {
      ...chatSnapshot,
      accounts: chatSnapshot.accounts.map((account) => account.id === "bot3"
        ? { ...account, connection: "action_required" as const, authentication: "unauthenticated" as const }
        : account.id === "bot1"
          ? { ...account, connection: "connected" as const, authentication: "authenticated" as const }
          : account),
      limitResumes: [],
    };
    render(<ChatsPage snapshot={sourceUnauthenticated} api={{ ...api, moveThreadToAccount }} />);

    const archive = screen.getByRole("button", { name: "Archive chat" });
    const move = screen.getByRole("button", { name: "Move to another account" });
    expect(move).toBeVisible();
    expect(archive.nextElementSibling).toBe(move);

    await user.click(move);
    expect(screen.getByRole("dialog", { name: "Move to another account" })).toBeVisible();
  });

  it("blocks messages to an account that requires sign-in and explains how to recover", async () => {
    setViewport(1440);
    const startTurn = vi.fn(async () => ({ data: {} }));
    const sourceUnauthenticated = {
      ...chatSnapshot,
      accounts: chatSnapshot.accounts.map((account) => account.id === "bot3"
        ? { ...account, connection: "action_required" as const, authentication: "unauthenticated" as const }
        : account),
    };

    render(<ChatsPage snapshot={sourceUnauthenticated} api={{ ...api, startTurn }} />);

    expect(screen.getByRole("status", { name: "Account sign-in required" })).toHaveTextContent("Sign in to bot3 to send messages.");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(startTurn).not.toHaveBeenCalled();
  });

  it("queues messages for automatic resume while the selected chat is waiting for its limit", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    const startTurn = vi.fn(async () => ({ data: { queued: true, clientUserMessageId: "queued-1" } }));
    const markTurnActive = vi.fn();
    const waitingSnapshot = {
      ...chatSnapshot,
      pendingApprovals: [],
      limitResumes: [{ accountId: "bot3" as const, threadId: "thread-1", state: "waiting_for_limit" as const, updatedAt: 2 }],
    };
    render(<ChatsPage snapshot={waitingSnapshot} api={{ ...api, startTurn }} markTurnActive={markTurnActive} />);

    await user.type(screen.getByRole("textbox", { name: "Message" }), "Also inspect the latest failure.");
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(startTurn).toHaveBeenCalledWith("bot3", "thread-1", "Also inspect the latest failure.", expect.any(Object));
    expect(markTurnActive).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Message" })).toHaveValue("");
    expect(screen.getByText("Message queued for resume.")).toBeVisible();
  });

  it("shows a yellow account wait indicator whenever one of its chats hit a usage limit", () => {
    setViewport(1440);
    const waitingSnapshot = {
      ...chatSnapshot,
      pendingApprovals: [],
      limitResumes: [{ accountId: "bot3" as const, threadId: "thread-1", state: "waiting_for_limit" as const, updatedAt: 2 }],
    };

    render(<ChatsPage snapshot={waitingSnapshot} api={api} />);

    expect(screen.getByLabelText("bot3 waiting for limit")).toHaveClass("chat-account-picker__activity--limit");
  });

  it("shows active work instead of a stale yellow wait when another chat is thinking", () => {
    setViewport(1440);
    const waitingSnapshot = {
      ...chatSnapshot,
      pendingApprovals: [],
      limitResumes: [{ accountId: "bot3" as const, threadId: "thread-1", state: "waiting_for_limit" as const, updatedAt: 2 }],
    };

    render(<ChatsPage snapshot={waitingSnapshot} api={api} activeTurnKeys={new Set(["bot3\u0000child-thread"])} />);

    expect(screen.queryByLabelText("bot3 waiting for limit")).not.toBeInTheDocument();
    expect(screen.getByLabelText("bot3 working")).toBeVisible();
  });

  it("clears the yellow wait state as soon as the durable chat state is resuming", () => {
    setViewport(1440);
    const resumingSnapshot = {
      ...chatSnapshot,
      pendingApprovals: [],
      limitResumes: [{ accountId: "bot3" as const, threadId: "thread-1", state: "resuming" as const, updatedAt: 2, resumeClientUserMessageId: "resume-1" }],
    };

    render(<ChatsPage snapshot={resumingSnapshot} api={api} limitExhaustedTurnKeys={new Set(["bot3\u0000thread-1"])} />);

    expect(screen.queryByLabelText("bot3 waiting for limit")).not.toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Session limit reached" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "T0 · Graph planning" })).not.toHaveTextContent("Waiting for limit");
  });

  it("shows unread reply dots on the chat and owning bot until that chat is opened", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    const markThreadRead = vi.fn();
    const unreadKey = "bot3\u0000thread-2";
    render(<ChatsPage snapshot={{ ...chatSnapshot, pendingApprovals: [] }} api={api} unreadTurnKeys={new Set([unreadKey])} markThreadRead={markThreadRead} />);

    expect(screen.getByLabelText("bot3 has unread replies")).toBeVisible();
    expect(screen.getByLabelText("U1 · Coordinator UI has an unread reply")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "U1 · Coordinator UI" }));

    await waitFor(() => expect(markThreadRead).toHaveBeenCalledWith("bot3", "thread-2"));
  });

  it("does not show an account notification for a stale chat key that is no longer listed", () => {
    setViewport(1440);
    render(<ChatsPage snapshot={{ ...chatSnapshot, pendingApprovals: [] }} api={api} unreadTurnKeys={new Set(["bot3\u0000missing-thread"])} />);

    expect(screen.queryByLabelText("bot3 has unread replies")).not.toBeInTheDocument();
  });

  it("does not recreate a notification dot from a pending approval after its chat is opened", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    const attentionKey = "bot3\u0000thread-2";
    const approval = { ...chatSnapshot.pendingApprovals[0], id: "approval-thread-2", threadId: "thread-2" };
    const approvalSnapshot = { ...chatSnapshot, pendingApprovals: [approval] };
    const markThreadRead = vi.fn();
    const view = render(<ChatsPage snapshot={approvalSnapshot} api={api} attentionTurnKeys={new Set([attentionKey])} markThreadRead={markThreadRead} />);

    expect(screen.getByLabelText("bot3 needs attention")).toBeVisible();
    expect(screen.getByLabelText("U1 · Coordinator UI needs attention")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "U1 · Coordinator UI" }));
    view.rerender(<ChatsPage snapshot={approvalSnapshot} api={api} attentionTurnKeys={new Set()} markThreadRead={markThreadRead} />);

    expect(screen.queryByLabelText("bot3 needs attention")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("U1 · Coordinator UI needs attention")).not.toBeInTheDocument();
  });

  it("flags an unassigned chat for resume when its durable limit record is waiting", () => {
    setViewport(1440);
    const unassignedLimitSnapshot = {
      ...chatSnapshot,
      workerAssignments: [],
      limitResumes: [{ accountId: "bot3" as const, threadId: "thread-1", state: "waiting_for_limit" as const, updatedAt: 2 }],
    };

    render(<ChatsPage snapshot={unassignedLimitSnapshot} api={api} />);

    expect(screen.getByRole("status", { name: "Session limit reached" })).toHaveTextContent("Waiting for usage availability before resuming. Retrying automatically.");
    expect(screen.getByRole("button", { name: "Move to another account" })).toBeVisible();
  });

  it("shows the waiting notice immediately from durable state while the selected chat is still lazy-loading", () => {
    setViewport(1440);
    const now = Date.now();
    const waitingSnapshot = {
      ...chatSnapshot,
      accounts: chatSnapshot.accounts.map((account) => account.id === "bot3" ? {
        ...account,
        rateLimits: [{ id: "five-hour", label: "Five-hour", usedPercent: 100, resetsAt: Math.floor(now / 1_000) + 7_500, updatedAt: now }],
      } : account),
      threads: [],
      workerAssignments: [],
      limitResumes: [{ accountId: "bot3" as const, threadId: "thread-1", state: "waiting_for_limit" as const, updatedAt: now }],
    };
    const listThreads = vi.fn(() => new Promise<never>(() => undefined));

    render(<ChatsPage snapshot={waitingSnapshot} api={{ ...api, listThreads }} initialTarget={{ accountId: "bot3", threadId: "thread-1" }} />);

    expect(screen.getByRole("status", { name: "Session limit reached" })).toHaveTextContent(/Waiting for limit to reset in 2h \d+m before resuming\./);
    expect(screen.getByRole("button", { name: "Move to another account" })).toBeVisible();
  });

  it("names authentication instead of a false reset countdown when a waiting account token expired", () => {
    setViewport(1440);
    const waitingSnapshot = {
      ...chatSnapshot,
      accounts: chatSnapshot.accounts.map((account) => account.id === "bot3" ? {
        ...account,
        connection: "action_required" as const,
        authentication: "unauthenticated" as const,
        errorCode: "ACCOUNT_AUTH_REQUIRED",
        rateLimits: [],
      } : account),
      workerAssignments: [],
      limitResumes: [{ accountId: "bot3" as const, threadId: "thread-1", state: "waiting_for_limit" as const, updatedAt: Date.now() }],
    };

    render(<ChatsPage snapshot={waitingSnapshot} api={api} />);

    expect(screen.getByRole("status", { name: "Session limit reached" })).toHaveTextContent("Sign in to bot3 before this chat can resume.");
    expect(screen.getByRole("status", { name: "Session limit reached" })).not.toHaveTextContent("under 1m");
    expect(screen.getByRole("button", { name: "Move to another account" })).toBeVisible();
    expect(screen.queryByLabelText("bot3 waiting for limit")).not.toBeInTheDocument();
  });

  it("shows automatic retry instead of an invented under-one-minute reset when reset data is unavailable", () => {
    setViewport(1440);
    const waitingSnapshot = {
      ...chatSnapshot,
      accounts: chatSnapshot.accounts.map((account) => account.id === "bot3" ? { ...account, rateLimits: [] } : account),
      workerAssignments: [],
      limitResumes: [{ accountId: "bot3" as const, threadId: "thread-1", state: "waiting_for_limit" as const, updatedAt: Date.now() }],
    };

    render(<ChatsPage snapshot={waitingSnapshot} api={api} />);

    expect(screen.getByRole("status", { name: "Session limit reached" })).toHaveTextContent("Waiting for usage availability before resuming. Retrying automatically.");
    expect(screen.getByRole("status", { name: "Session limit reached" })).not.toHaveTextContent("under 1m");
  });

  it("shows the resume controls immediately from the live limit event before the durable snapshot refresh finishes", () => {
    setViewport(1440);
    render(<ChatsPage snapshot={{ ...chatSnapshot, workerAssignments: [], limitResumes: [] }} api={api} limitExhaustedTurnKeys={new Set(["bot3\u0000thread-1"])} />);

    expect(screen.getByRole("status", { name: "Session limit reached" })).toHaveTextContent("Waiting for usage availability before resuming. Retrying automatically.");
    expect(screen.getByRole("button", { name: "Move to another account" })).toBeVisible();
    expect(screen.queryByLabelText("bot3 waiting for limit")).not.toBeInTheDocument();
  });

  it("does not show a stale resume notice after the durable assignment moved away", () => {
    setViewport(1440);
    const transferredSnapshot = {
      ...chatSnapshot,
      workerAssignments: [{ taskId: "T0", accountId: "bot1" as const, threadId: "continuation", state: "assigned" as const, assignedAt: 1, updatedAt: 2, transferHistory: [{ fromAccountId: "bot3" as const, fromThreadId: "thread-1", toAccountId: "bot1" as const, toThreadId: "continuation", transferredAt: 2 }] }],
    };

    render(<ChatsPage snapshot={transferredSnapshot} api={api} limitExhaustedTurnKeys={new Set(["bot3\u0000thread-1"])} />);

    expect(screen.queryByRole("status", { name: "Session limit reached" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("bot3 waiting for limit")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "T0 · Graph planning" })).not.toHaveTextContent("Waiting for limit");
  });

  it("does not show stale yellow limit state after an unassigned chat is transferred", () => {
    setViewport(1440);
    const transferredSnapshot = {
      ...chatSnapshot,
      workerAssignments: [],
      limitResumes: [{ accountId: "bot3" as const, threadId: "thread-1", state: "transferred" as const, updatedAt: 2 }],
    };

    render(<ChatsPage snapshot={transferredSnapshot} api={api} limitExhaustedTurnKeys={new Set(["bot3\u0000thread-1"])} />);

    expect(screen.queryByRole("status", { name: "Session limit reached" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("bot3 waiting for limit")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "T0 · Graph planning" })).not.toHaveTextContent("Waiting for limit");
  });

  it("enables thread controls only for reported capabilities", async () => {
    setViewport(390);
    const user = userEvent.setup();
    render(<ChatsPage snapshot={chatSnapshot} api={api} activeTurnIds={new Map([["bot3\u0000thread-1", "turn-1"]])} />);

    await screen.findByRole("article", { name: "userMessage" });
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Archive chat" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Steer" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Interrupt" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "bot3" }));
    await user.click(screen.getByRole("button", { name: "U1 · Coordinator UI" }));
    expect(screen.queryByText("Unavailable")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Archive chat" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Steer" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Interrupt" })).toBeDisabled();
  });

  it("archives any selected persisted chat instead of requiring a transient capability flag", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    const archiveThread = vi.fn(async () => ({ data: {} }));
    render(<ChatsPage snapshot={chatSnapshot} api={{ ...api, archiveThread }} initialThreadId="thread-2" />);

    await user.click(screen.getByRole("button", { name: "Archive chat" }));

    expect(archiveThread).toHaveBeenCalledWith("bot3", "thread-2");
  });

  it("shows only the normalized available decisions for a pending approval in the selected chat", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    render(<ChatsPage snapshot={chatSnapshot} api={api} />);

    expect(await screen.findByText("rm -rf /Users/bot4")).toBeVisible();
    expect(screen.getByRole("button", { name: "Decline approval" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Approve approval" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Decline approval" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Approval response sent.");
  });

  it("keeps multiple approvals in one panel row so the composer remains in the chat grid", () => {
    setViewport(390);
    const secondApproval = {
      ...chatSnapshot.pendingApprovals[0],
      id: "approval-2",
      itemId: "command-2",
      summary: "git push origin main",
    };
    const { container } = render(
      <ChatsPage snapshot={{ ...chatSnapshot, pendingApprovals: [chatSnapshot.pendingApprovals[0], secondApproval] }} api={api} />,
    );

    expect(container.querySelectorAll(".chat-approvals .chat-approval")).toHaveLength(2);
  });

  it("sends the exact requested turn permissions only after an explicit grant choice", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    const requestedPermissions = { network: { enabled: true } };
    const approval = { ...chatSnapshot.pendingApprovals[0], method: "item/permissions/requestApproval", availableDecisions: ["grant_turn", "grant_turn_strict", "deny"], requestedPermissions };
    const decideApproval = vi.fn(async () => ({ data: {} }));
    render(<ChatsPage snapshot={{ ...chatSnapshot, pendingApprovals: [approval] }} api={{ ...api, decideApproval }} />);

    await user.click(await screen.findByRole("button", { name: "Grant requested turn permissions" }));

    expect(decideApproval).toHaveBeenCalledWith(approval, "grant_turn", requestedPermissions);
  });

  it("reports an unavailable open-terminal clipboard action instead of claiming success", async () => {
    setViewport(1440);
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(new Error("denied"));
    const user = userEvent.setup();
    try {
      render(<ChatsPage snapshot={chatSnapshot} api={api} />);
      await user.click(screen.getByRole("button", { name: "Copy open-terminal command" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("Unable to copy the open-terminal command.");
    } finally {
      writeText.mockRestore();
    }
  });
});
