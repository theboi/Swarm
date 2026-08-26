import { describe, expect, it } from "vitest";
import { extractMarkdownPaths, hydrateTranscript, initialTranscriptState, reduceTranscriptEvent } from "./transcriptReducer.js";

const scope = { accountId: "bot1" as const, threadId: "thread-1" };

describe("transcriptReducer", () => {
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

  it("hydrates complete thread history in turn order and reconciles replayed real-v2 deltas without a deltaId", () => {
    let state = hydrateTranscript(initialTranscriptState, {
      ...scope,
      turns: [
        { id: "turn-2", startedAt: 20, items: [{ type: "agentMessage", id: "item-2", text: "later", phase: null, memoryCitation: null }] },
        { id: "turn-1", startedAt: 10, items: [{ type: "commandExecution", id: "command-1", command: "git status", cwd: "/Users/bot1/Dev/EdenMind", status: "inProgress", aggregatedOutput: "first", commandActions: [] }] },
      ],
    });
    // The generated v2 envelope is only threadId, turnId, itemId, and delta.
    state = reduceTranscriptEvent(state, { method: "item/commandExecution/outputDelta", params: { ...scope, turnId: "turn-1", itemId: "command-1", delta: " second" } });
    state = reduceTranscriptEvent(state, { method: "item/commandExecution/outputDelta", params: { ...scope, turnId: "turn-1", itemId: "command-1", delta: " second" } });
    expect(state.items[0]?.payload.aggregatedOutput).toBe("first second");
    state = reduceTranscriptEvent(state, { method: "item/completed", params: { ...scope, turnId: "turn-1", completedAtMs: 30_000, item: { type: "commandExecution", id: "command-1", command: "git status", cwd: "/Users/bot1/Dev/EdenMind", status: "completed", aggregatedOutput: "first second", commandActions: [], exitCode: 0 } } });
    const replayed = reduceTranscriptEvent(state, { method: "item/completed", params: { ...scope, turnId: "turn-1", completedAtMs: 30_000, item: { type: "commandExecution", id: "command-1", command: "git status", cwd: "/Users/bot1/Dev/EdenMind", status: "completed", aggregatedOutput: "first second", commandActions: [], exitCode: 0 } } });

    expect(replayed.items.map((item) => item.id)).toEqual(["command-1", "item-2"]);
    expect(replayed.items[0]).toMatchObject({ turnId: "turn-1", status: "completed", payload: { aggregatedOutput: "first second", exitCode: 0 } });
    expect(replayed).toEqual(state);
  });

  it("retains exact command output and recognizes only Markdown file paths for safe viewer requests", () => {
    expect(extractMarkdownPaths("Read docs/plan.md, ./notes/brief.markdown, and image.png.")).toEqual(["docs/plan.md", "./notes/brief.markdown"]);
    expect(extractMarkdownPaths("/Users/bot2/Dev/EdenMind/secret.md and report.pdf")).toEqual(["/Users/bot2/Dev/EdenMind/secret.md"]);
  });
});
