import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatsPage, normalizeExecutionSettings } from "./ChatsPage";
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
  archiveThread: async () => ({ data: {} }),
  steerTurn: async () => ({ data: {} }),
  interruptTurn: async () => ({ data: {} }),
  decideApproval: async () => ({ data: {} }),
};

describe("ChatsPage", () => {
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
    render(<ChatsPage snapshot={chatSnapshot} api={{ ...api, readTranscript, startTurn }} markTurnActive={markTurnActive} />);

    const pill = await screen.findByRole("button", { name: "Open subagent ui-review" });
    expect(screen.getAllByRole("button", { name: "Open subagent ui-review" })).toHaveLength(1);
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
    expect(screen.getByRole("button", { name: "bot1" })).toBeVisible();
  });

  it("selects the owning account when Flowchart opens a mapped chat", async () => {
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
    render(<ChatsPage snapshot={chatSnapshot} api={api} activeTurnKeys={new Set(["bot3\u0000thread-1"])} />);

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
    const moveThreadToAccount = vi.fn(async () => ({ data: { id: "continuation", accountId: "bot1" as const, name: "Continuation", archived: false, updatedAt: 1, capabilities: { canArchive: false, canInterrupt: true, canStartTurn: false, canSteer: true } } }));
    const continuationSnapshot = {
      ...chatSnapshot,
      accounts: chatSnapshot.accounts.map((account) => account.id === "bot1" ? { ...account, connection: "connected" as const, authentication: "authenticated" as const } : account),
      workerAssignments: [{ taskId: "T0", accountId: "bot3" as const, threadId: "thread-1", state: "waiting_for_limit" as const, assignedAt: 1, updatedAt: 2, transferHistory: [] }],
    };
    render(<ChatsPage snapshot={continuationSnapshot} api={{ ...api, moveThreadToAccount }} />);

    expect(screen.getByRole("status", { name: "Session limit reached" })).toHaveTextContent("Waiting for limit to reset");
    await user.click(screen.getByRole("button", { name: "Move to another account" }));
    const dialog = screen.getByRole("dialog", { name: "Move to another account" });
    expect(dialog).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Close" })).toHaveClass("overlay-close-button");
    expect(within(dialog).queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "bot1" }));
    await user.click(screen.getByRole("button", { name: "Move to bot1" }));

    expect(moveThreadToAccount).toHaveBeenCalledWith("bot3", "thread-1", "bot1");
  });

  it("does not show a stale resume notice after the durable assignment moved away", () => {
    setViewport(1440);
    const transferredSnapshot = {
      ...chatSnapshot,
      workerAssignments: [{ taskId: "T0", accountId: "bot1" as const, threadId: "continuation", state: "assigned" as const, assignedAt: 1, updatedAt: 2, transferHistory: [{ fromAccountId: "bot3" as const, fromThreadId: "thread-1", toAccountId: "bot1" as const, toThreadId: "continuation", transferredAt: 2 }] }],
    };

    render(<ChatsPage snapshot={transferredSnapshot} api={api} limitExhaustedTurnKeys={new Set(["bot3\u0000thread-1"])} />);

    expect(screen.queryByRole("status", { name: "Session limit reached" })).not.toBeInTheDocument();
  });

  it("enables thread controls only for reported capabilities", async () => {
    setViewport(390);
    const user = userEvent.setup();
    render(<ChatsPage snapshot={chatSnapshot} api={api} />);

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
