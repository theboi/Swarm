import { describe, expect, it } from "vitest";
import { extractMarkdownPaths, hydrateTranscript, initialTranscriptState, reduceTranscriptEvent } from "./transcriptReducer.js";

const scope = { accountId: "bot1" as const, threadId: "thread-1" };

describe("transcriptReducer", () => {
  it("hydrates a long authoritative transcript without quadratic rescanning", () => {
    const items = Array.from({ length: 8_000 }, (_, index) => ({
      type: "agentMessage",
      id: `item-${index}`,
      text: `Message ${index}`,
    }));
    const startedAt = performance.now();

    const state = hydrateTranscript(initialTranscriptState, {
      ...scope,
      turns: [{ id: "turn-1", startedAt: 10, itemsView: "full", items }],
    });

    expect(state.items).toHaveLength(8_000);
    expect(state.items.at(-1)?.id).toBe("item-7999");
    expect(performance.now() - startedAt).toBeLessThan(500);
  });

  it("normalizes every current v2 thread item form and preserves an unknown form as an opaque record", () => {
    const variants = [
      { type: "userMessage", id: "user", content: [{ type: "text", text: "hi" }] },
      { type: "hookPrompt", id: "hook", fragments: [] },
      { type: "agentMessage", id: "agent", text: "answer", phase: null, memoryCitation: null },
      { type: "plan", id: "plan", text: "1. test" },
      { type: "reasoning", id: "reason", summary: ["summary"], content: [] },
      { type: "commandExecution", id: "command", command: "git status", cwd: "/Users/bot1/Dev/EdenMind", status: "completed", aggregatedOutput: "clean", commandActions: [] },
      { type: "fileChange", id: "file", changes: [], status: "completed" },
      { type: "mcpToolCall", id: "mcp", server: "local", tool: "read", status: "completed", arguments: {}, result: null, error: null },
      { type: "dynamicToolCall", id: "dynamic", namespace: "apps", tool: "read", arguments: {}, status: "completed", contentItems: null, success: true },
      { type: "collabAgentToolCall", id: "collab", tool: "spawn", status: "completed", senderThreadId: "thread-1", receiverThreadIds: [], prompt: null, model: null, reasoningEffort: null, agentsStates: {} },
      { type: "subAgentActivity", id: "activity", kind: "spawned", agentThreadId: "child", agentPath: "worker" },
      { type: "webSearch", id: "web", query: "Codex" },
      { type: "imageView", id: "image", path: "/Users/bot1/Dev/EdenMind/image.png" },
      { type: "sleep", id: "sleep", duration: 1 },
      { type: "imageGeneration", id: "generated", prompt: "a chart" },
      { type: "enteredReviewMode", id: "entered", review: "security" },
      { type: "exitedReviewMode", id: "exited", review: "security" },
      { type: "contextCompaction", id: "compact" },
    ];

    let state = initialTranscriptState;
    for (const item of variants) state = reduceTranscriptEvent(state, { method: "item/completed", params: { ...scope, turnId: "turn-1", completedAtMs: 1_000, item } });
    state = reduceTranscriptEvent(state, { method: "item/completed", params: { ...scope, turnId: "turn-1", completedAtMs: 1_000, item: { type: "futureItem", id: "future", unsafe: "never execute this" } } });

    expect(state.items).toHaveLength(19);
    expect(state.items.slice(0, 18).map((item) => item.type)).toEqual(variants.map((item) => item.type));
    expect(state.items.at(-1)).toMatchObject({ id: "future", type: "opaque", payload: { originalType: "futureItem" } });
  });

  it("preserves sequential equal live output deltas exactly", () => {
    let state = hydrateTranscript(initialTranscriptState, {
      ...scope,
      turns: [
        { id: "turn-2", startedAt: 20, itemsView: "full", items: [{ type: "agentMessage", id: "item-2", text: "later", phase: null, memoryCitation: null }] },
        { id: "turn-1", startedAt: 10, itemsView: "full", items: [{ type: "commandExecution", id: "command-1", command: "git status", cwd: "/Users/bot1/Dev/EdenMind", status: "inProgress", aggregatedOutput: "first", commandActions: [] }] },
      ],
    });
    // The generated v2 envelope has no delta id. Equal adjacent deltas are
    // still distinct bytes from the live stream and must both be retained.
    state = reduceTranscriptEvent(state, { method: "item/commandExecution/outputDelta", params: { ...scope, turnId: "turn-1", itemId: "command-1", delta: " second" } });
    state = reduceTranscriptEvent(state, { method: "item/commandExecution/outputDelta", params: { ...scope, turnId: "turn-1", itemId: "command-1", delta: " second" } });
    expect(state.items[0]?.payload.aggregatedOutput).toBe("first second second");
  });

  it("preserves authoritative server order when an older turn has no timestamp", () => {
    const state = hydrateTranscript(initialTranscriptState, {
      ...scope,
      turns: [
        { id: "turn-old", startedAt: null, itemsView: "full", items: [{ type: "agentMessage", id: "old", text: "old final answer" }] },
        { id: "turn-new", startedAt: 20, itemsView: "full", items: [{ type: "agentMessage", id: "new", text: "new final answer" }] },
      ],
    });

    expect(state.items.map((item) => item.id)).toEqual(["old", "new"]);
  });

  it("streams reasoning-summary deltas into the live reasoning item without exposing raw reasoning text", () => {
    let state = reduceTranscriptEvent(initialTranscriptState, {
      method: "item/started",
      params: { ...scope, turnId: "turn-1", startedAtMs: 1_000, item: { type: "reasoning", id: "reason-1", summary: [] } },
    });
    state = reduceTranscriptEvent(state, { method: "item/reasoning/summaryTextDelta", params: { ...scope, turnId: "turn-1", itemId: "reason-1", delta: "Checked the launch response." } });
    state = reduceTranscriptEvent(state, { method: "item/reasoning/textDelta", params: { ...scope, turnId: "turn-1", itemId: "reason-1", delta: "private reasoning must not appear" } });

    expect(state.items[0]).toMatchObject({ type: "reasoning", payload: { summary: ["Checked the launch response."] } });
    expect(JSON.stringify(state.items)).not.toContain("private reasoning");
  });

  it("marks a disconnect incomplete then replaces one scope from authoritative thread history", () => {
    let state = hydrateTranscript(initialTranscriptState, {
      ...scope,
      turns: [{ id: "turn-1", startedAt: 10, itemsView: "full", items: [{ type: "agentMessage", id: "stale", text: "stale output" }] }],
    });
    state = reduceTranscriptEvent(state, { method: "transcript/disconnected", params: scope });

    const key = `${scope.accountId}\u0000${scope.threadId}`;
    expect((state as unknown as { recoveryByScope?: ReadonlyMap<string, string> }).recoveryByScope?.get(key)).toBe("disconnected");

    state = reduceTranscriptEvent(state, { method: "transcript/recoveryStarted", params: scope });
    expect((state as unknown as { recoveryByScope?: ReadonlyMap<string, string> }).recoveryByScope?.get(key)).toBe("recovering");
    state = hydrateTranscript(state, {
      ...scope,
      turns: [{ id: "turn-1", startedAt: 10, itemsView: "full", items: [{ type: "agentMessage", id: "fresh", text: "authoritative output" }] }],
    });

    expect(state.items.map((item) => item.id)).toEqual(["fresh"]);
    expect((state as unknown as { recoveryByScope?: ReadonlyMap<string, string> }).recoveryByScope?.get(key)).toBe("complete");
  });

  it("keeps completed items idempotent after authoritative recovery", () => {
    let state = hydrateTranscript(initialTranscriptState, {
      ...scope,
      turns: [{ id: "turn-1", startedAt: 10, itemsView: "full", items: [{ type: "commandExecution", id: "command-1", command: "git status", cwd: "/Users/bot1/Dev/EdenMind", status: "inProgress", aggregatedOutput: "first", commandActions: [] }] }],
    });
    state = reduceTranscriptEvent(state, { method: "item/completed", params: { ...scope, turnId: "turn-1", completedAtMs: 30_000, item: { type: "commandExecution", id: "command-1", command: "git status", cwd: "/Users/bot1/Dev/EdenMind", status: "completed", aggregatedOutput: "first second", commandActions: [], exitCode: 0 } } });
    const replayed = reduceTranscriptEvent(state, { method: "item/completed", params: { ...scope, turnId: "turn-1", completedAtMs: 30_000, item: { type: "commandExecution", id: "command-1", command: "git status", cwd: "/Users/bot1/Dev/EdenMind", status: "completed", aggregatedOutput: "first second", commandActions: [], exitCode: 0 } } });

    expect(replayed.items.map((item) => item.id)).toEqual(["command-1"]);
    expect(replayed.items[0]).toMatchObject({ turnId: "turn-1", status: "completed", payload: { aggregatedOutput: "first second", exitCode: 0 } });
    expect(replayed).toEqual(state);
  });

  it("leaves a scope untouched when thread/read does not prove every returned turn is full", () => {
    const state = hydrateTranscript(initialTranscriptState, {
      ...scope,
      turns: [{ id: "turn-1", startedAt: 10, itemsView: "full", items: [{ type: "agentMessage", id: "kept", text: "known complete" }] }],
    });
    const partial = {
      ...scope,
      turns: [{ id: "turn-1", startedAt: 10, itemsView: "summary", items: [{ type: "agentMessage", id: "replace-me", text: "partial" }] }],
    };

    expect(hydrateTranscript(state, partial as Parameters<typeof hydrateTranscript>[1])).toBe(state);
  });

  it("freezes every live item replay while a previously complete scope is disconnected or recovering", () => {
    const complete = hydrateTranscript(initialTranscriptState, {
      ...scope,
      turns: [{ id: "turn-1", startedAt: 10, itemsView: "full", items: [{ type: "agentMessage", id: "kept", text: "authoritative" }] }],
    });
    const disconnected = reduceTranscriptEvent(complete, { method: "transcript/disconnected", params: scope });
    const completedReplay = reduceTranscriptEvent(disconnected, {
      method: "item/completed",
      params: { ...scope, turnId: "turn-1", completedAtMs: 20_000, item: { type: "agentMessage", id: "kept", text: "stale replay" } },
    });
    expect(completedReplay).toBe(disconnected);

    const recovering = reduceTranscriptEvent(disconnected, { method: "transcript/recoveryStarted", params: scope });
    const startedReplay = reduceTranscriptEvent(recovering, {
      method: "item/started",
      params: { ...scope, turnId: "turn-2", startedAtMs: 20_000, item: { type: "agentMessage", id: "new-stale", text: "stale replay" } },
    });
    expect(startedReplay).toBe(recovering);
  });

  it("retains exact command output and recognizes only Markdown file paths for safe viewer requests", () => {
    expect(extractMarkdownPaths("Read docs/plan.md, ./notes/brief.markdown, and image.png.")).toEqual(["docs/plan.md", "./notes/brief.markdown"]);
    expect(extractMarkdownPaths("/Users/bot2/Dev/EdenMind/secret.md and report.pdf")).toEqual(["/Users/bot2/Dev/EdenMind/secret.md"]);
  });
});
