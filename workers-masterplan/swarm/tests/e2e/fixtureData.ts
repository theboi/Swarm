import type { AccountSnapshot, CoordinatorSnapshot, TaskNode, TranscriptItem } from "../../src/shared/contracts.js";

export const FIXTURE_CREDENTIALS = {
  email: "operator@fixture.test",
  password: "fixture-only-password",
  totpSecret: "JBSWY3DPEHPK3PXP",
} as const;

export type FixtureManifest = "blocked" | "ready";

export interface FixtureState {
  snapshot: CoordinatorSnapshot;
  transcripts: Map<string, TranscriptItem[]>;
  markdownFiles: Map<string, { filename: string; content: string }>;
}

const timestamp = 1_725_000_000;

function account(id: AccountSnapshot["id"], patch: Partial<AccountSnapshot> = {}): AccountSnapshot {
  return {
    id,
    connection: "connected",
    authentication: "authenticated",
    rateLimits: [
      { id: `${id}:five-hour`, label: "Five-hour", usedPercent: 40, resetsAt: 1_725_018_000, updatedAt: timestamp },
      { id: `${id}:weekly`, label: "Weekly", usedPercent: 20, resetsAt: 1_725_100_000, updatedAt: timestamp },
    ],
    activeTurns: 0,
    lastAssignedAt: timestamp - 1_000,
    ...patch,
  };
}

function fixtureAccounts(): AccountSnapshot[] {
  return [
    account("bot1", { connection: "action_required", authentication: "unauthenticated", rateLimits: [], lastAssignedAt: null, terminalCommand: "/usr/bin/su - bot1 -c '/opt/homebrew/bin/codex login'", errorCode: "ACCOUNT_AUTH_REQUIRED" }),
    account("bot2", { rateLimits: [{ id: "bot2:five-hour", label: "Five-hour", usedPercent: 20, resetsAt: 1_725_018_000, updatedAt: timestamp }, { id: "bot2:weekly", label: "Weekly", usedPercent: 80, resetsAt: 1_725_100_000, updatedAt: timestamp }] }),
    account("bot3", { activeTurns: 1 }),
    account("bot4", { connection: "disconnected", authentication: "unknown", rateLimits: [], lastAssignedAt: null }),
    account("bot5", { rateLimits: [{ id: "bot5:five-hour", label: "Five-hour", usedPercent: 10, resetsAt: 1_725_018_000, updatedAt: timestamp }, { id: "bot5:weekly", label: "Weekly", usedPercent: 35, resetsAt: 1_725_100_000, updatedAt: timestamp }] }),
    account("bot6", { rateLimits: [{ id: "bot6:five-hour", label: "Five-hour", usedPercent: 70, resetsAt: 1_725_018_000, updatedAt: timestamp }, { id: "bot6:weekly", label: "Weekly", usedPercent: 10, resetsAt: 1_725_100_000, updatedAt: timestamp }] }),
    account("bot7", { authentication: "unauthenticated", rateLimits: [], lastAssignedAt: null, terminalCommand: "/usr/bin/su - bot7 -c '/opt/homebrew/bin/codex login'", errorCode: "ACCOUNT_AUTH_REQUIRED" }),
    account("bot8", { connection: "error", authentication: "unknown", rateLimits: [], lastAssignedAt: null, errorCode: "ACCOUNT_OFFLINE" }),
  ];
}

function readyTasks(): TaskNode[] {
  return [
    { id: "T0", title: "Graph planning", kind: "planning", dependsOn: [], promptTemplate: "planning", readiness: { taskId: "T0", state: "running", phase: "planning", evidence: [], blockingCodes: [], suggestedAccount: "bot3" } },
    { id: "U1", title: "Coordinator UI", kind: "ui", dependsOn: ["T0"], promptTemplate: "ui", readiness: { taskId: "U1", state: "ready", phase: "ui", evidence: [{ code: "PLANNING_GATE", satisfied: true }], blockingCodes: [], suggestedAccount: "bot5" } },
    { id: "I0", title: "Integration", kind: "execution", dependsOn: ["U1"], promptTemplate: "execution", readiness: { taskId: "I0", state: "blocked", phase: "execution", evidence: [{ code: "MASTERPLAN_NOT_READY", satisfied: false }], blockingCodes: ["MASTERPLAN_NOT_READY"] } },
  ];
}

function transcript(): TranscriptItem[] {
  return [
    { id: "user-1", accountId: "bot3", threadId: "thread-1", turnId: "turn-1", type: "userMessage", status: "completed", createdAt: timestamp, payload: { content: [{ type: "text", text: "Read docs/runbook.md" }] } },
    { id: "agent-1", accountId: "bot3", threadId: "thread-1", turnId: "turn-1", type: "agentMessage", status: "completed", createdAt: timestamp + 1, payload: { text: "I found the coordinator runbook." } },
    { id: "plan-1", accountId: "bot3", threadId: "thread-1", turnId: "turn-1", type: "plan", status: "completed", createdAt: timestamp + 2, payload: { text: "1. Verify the graph" } },
    { id: "reasoning-1", accountId: "bot3", threadId: "thread-1", turnId: "turn-1", type: "reasoning", status: "completed", createdAt: timestamp + 3, payload: { summary: ["Checked normalized fixture state"] } },
    { id: "command-1", accountId: "bot3", threadId: "thread-1", turnId: "turn-1", type: "commandExecution", status: "completed", createdAt: timestamp + 4, payload: { command: "git status --short", aggregatedOutput: " M workers-masterplan/swarm/src/client/App.tsx\n" } },
    { id: "file-1", accountId: "bot3", threadId: "thread-1", turnId: "turn-1", type: "fileChange", status: "completed", createdAt: timestamp + 5, payload: { changes: [{ path: "src/client/App.tsx", kind: "update" }] } },
    { id: "subagent-1", accountId: "bot3", threadId: "thread-1", turnId: "turn-1", type: "subAgentActivity", status: "completed", createdAt: timestamp + 6, payload: { kind: "spawned", agentPath: "ui-review" } },
    { id: "opaque-1", accountId: "bot3", threadId: "thread-1", turnId: "turn-1", type: "opaque", status: null, createdAt: timestamp + 7, payload: { originalType: "futureItem", raw: { detail: "Retained safely" } } },
  ];
}

export function createFixtureState(options: { manifest?: FixtureManifest } = {}): FixtureState {
  const manifest = options.manifest ?? "blocked";
  const snapshot: CoordinatorSnapshot = {
    generatedAt: timestamp,
    activeTurnLimit: 3,
    accounts: fixtureAccounts(),
    tasks: manifest === "ready" ? readyTasks() : [],
    dispatches: manifest === "ready" ? [{ id: "dispatch-1", clientUserMessageId: "fixture-message-1", taskId: "T0", accountId: "bot3", threadId: "thread-1", state: "accepted", createdAt: timestamp, updatedAt: timestamp + 10, retryAt: null }] : [],
    threads: [
      { id: "thread-1", accountId: "bot3", name: "T0 · Graph planning", archived: false, updatedAt: timestamp, capabilities: { canArchive: true, canInterrupt: true, canStartTurn: true, canSteer: true } },
      { id: "thread-2", accountId: "bot3", name: "U1 · Coordinator UI", archived: false, updatedAt: timestamp + 100, capabilities: { canArchive: false, canInterrupt: false, canStartTurn: false, canSteer: false } },
      { id: "thread-3", accountId: "bot1", name: "Account recovery", archived: false, updatedAt: timestamp + 200, capabilities: { canArchive: true, canInterrupt: false, canStartTurn: true, canSteer: false } },
    ],
    pendingApprovals: [{ id: "approval-1", accountId: "bot3", threadId: "thread-1", turnId: "turn-1", itemId: "command-1", method: "item/commandExecution/requestApproval", summary: "rm -rf /Users/bot4", availableDecisions: ["decline"], createdAt: timestamp }],
    ngrok: { state: "stopped", publicUrl: null, message: null, nextBoundaryAt: 1_725_018_000 },
    health: { server: { state: "ok" }, stateStore: { state: "ok" }, readiness: { state: "ok" }, outbox: { state: "ok" }, scheduler: { state: "ok" }, ngrok: { state: "ok" }, accounts: { state: "ok" } },
  };
  return {
    snapshot,
    transcripts: new Map([["bot3:thread-1", transcript()]]),
    markdownFiles: new Map([["bot3:docs/runbook.md", { filename: "runbook.md", content: "# Runbook\n\n<script>window.evil = true</script>\n\nFixture-only coordinator instructions." }]]),
  };
}
