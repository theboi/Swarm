import type { CoordinatorSnapshot, TranscriptItem } from "../../shared/contracts.js";

export const snapshot: CoordinatorSnapshot = {
  generatedAt: 1_725_000_000,
  autoPilot: { enabled: false },
  accounts: [
    {
      id: "bot3",
      connection: "connected",
      authentication: "authenticated",
      rateLimits: [
        { id: "five-hour", label: "Five-hour", usedPercent: 40, resetsAt: 1_725_018_000, updatedAt: 1_725_000_000 },
        { id: "weekly", label: "Weekly", usedPercent: 20, resetsAt: 1_725_100_000, updatedAt: 1_725_000_000 },
      ],
      activeTurns: 1,
      lastAssignedAt: 1_724_999_000,
    },
  ],
  tasks: [],
  dispatches: [],
  threads: [],
  pendingApprovals: [],
  health: {
    server: { state: "ok" },
    stateStore: { state: "ok" },
    readiness: { state: "ok" },
    outbox: { state: "ok" },
    scheduler: { state: "ok" },
    accounts: { state: "ok" },
  },
};

export const dashboardSnapshot: CoordinatorSnapshot = {
  ...snapshot,
  accounts: [
    ...snapshot.accounts,
    {
      id: "bot1",
      connection: "action_required",
      authentication: "unauthenticated",
      rateLimits: [],
      activeTurns: 0,
      lastAssignedAt: null,
      terminalCommand: "su - bot1 -c 'codex login'",
    },
  ],
  tasks: [
    {
      id: "T0", title: "Graph planning", kind: "planning", dependsOn: [], promptTemplate: "planning",
      readiness: { taskId: "T0", state: "running", phase: "planning", evidence: [], blockingCodes: [], suggestedAccount: "bot3" },
    },
    {
      id: "U1", title: "Coordinator UI", kind: "ui", dependsOn: ["T0"], promptTemplate: "ui",
      readiness: { taskId: "U1", state: "ready", phase: "ui", evidence: [{ code: "PLANNING_GATE", satisfied: true }], blockingCodes: [], suggestedAccount: "bot3" },
    },
    {
      id: "I0", title: "Integration", kind: "execution", dependsOn: ["U1"], promptTemplate: "execution",
      readiness: { taskId: "I0", state: "blocked", phase: "execution", evidence: [], blockingCodes: ["PLANNING_GATE"] },
    },
  ],
  dispatches: [
    { id: "dispatch-1", clientUserMessageId: "message-1", taskId: "T0", accountId: "bot3", threadId: "thread-1", state: "accepted", origin: "operator", createdAt: 1_725_000_000, updatedAt: 1_725_000_100, retryAt: null },
    { id: "dispatch-2", clientUserMessageId: "message-2", taskId: "U1", accountId: "bot3", threadId: "thread-2", state: "queued", origin: "operator", createdAt: 1_725_000_000, updatedAt: 1_725_000_100, retryAt: null },
  ],
  pendingApprovals: [
    { id: "approval-1", accountId: "bot3", threadId: "thread-1", turnId: "turn-1", itemId: "item-1", method: "item/commandExecution/requestApproval", summary: "rm -rf /Users/bot4", availableDecisions: ["decline"], createdAt: 1_725_000_000 },
  ],
};

/** Isolated logical profile fixture used by account-management UI tests. */
export const profileDashboardSnapshot: CoordinatorSnapshot = {
  ...dashboardSnapshot,
  accounts: [
    { id: "bot1/acc1", macosUser: "bot1", accountNumber: 1, workspaceRoot: "/Users/bot1/Dev/EdenMind", isPrimary: true, connection: "connected", authentication: "authenticated", rateLimits: [], activeTurns: 0, lastAssignedAt: null },
    { id: "bot1/acc2", macosUser: "bot1", accountNumber: 2, workspaceRoot: "/Users/bot1/Dev/EdenMind", isPrimary: false, connection: "action_required", authentication: "unauthenticated", rateLimits: [], activeTurns: 0, lastAssignedAt: null },
  ],
};

export const chatSnapshot: CoordinatorSnapshot = {
  ...dashboardSnapshot,
  accounts: dashboardSnapshot.accounts.map((account) => account.id === "bot3" ? { ...account, terminalCommand: "open -a Codex /Users/bot3/Dev/EdenMind" } : account),
  threads: [
    { id: "thread-1", accountId: "bot3", name: "T0 · Graph planning", archived: false, updatedAt: 1_725_000_000, capabilities: { canArchive: true, canInterrupt: true, canStartTurn: true, canSteer: true } },
    { id: "thread-2", accountId: "bot3", name: "U1 · Coordinator UI", archived: false, updatedAt: 1_725_000_100, capabilities: { canArchive: false, canInterrupt: false, canStartTurn: false, canSteer: false } },
    { id: "thread-3", accountId: "bot1", name: "Account recovery", archived: false, updatedAt: 1_725_000_200, capabilities: { canArchive: true, canInterrupt: false, canStartTurn: true, canSteer: false } },
  ],
};

export const chatTranscript: TranscriptItem[] = [
  { id: "user-1", accountId: "bot3", threadId: "thread-1", turnId: "turn-1", type: "userMessage", status: "completed", createdAt: 1_725_000_000, payload: { content: [{ type: "text", text: "Read docs/runbook.md" }] } },
  { id: "agent-1", accountId: "bot3", threadId: "thread-1", turnId: "turn-1", type: "agentMessage", status: "completed", createdAt: 1_725_000_001, payload: { text: "I found the coordinator runbook." } },
  { id: "plan-1", accountId: "bot3", threadId: "thread-1", turnId: "turn-1", type: "plan", status: "completed", createdAt: 1_725_000_002, payload: { text: "1. Verify the graph" } },
  { id: "reason-1", accountId: "bot3", threadId: "thread-1", turnId: "turn-1", type: "reasoning", status: "completed", createdAt: 1_725_000_003, payload: { summary: ["Checked normalized state"] } },
  { id: "command-1", accountId: "bot3", threadId: "thread-1", turnId: "turn-1", type: "commandExecution", status: "completed", createdAt: 1_725_000_004, payload: { command: "git status", aggregatedOutput: "On branch main" } },
  { id: "file-1", accountId: "bot3", threadId: "thread-1", turnId: "turn-1", type: "fileChange", status: "completed", createdAt: 1_725_000_005, payload: { changes: [{ path: "src/client/App.tsx", kind: "update" }] } },
  { id: "agent-activity", accountId: "bot3", threadId: "thread-1", turnId: "turn-1", type: "subAgentActivity", status: "completed", createdAt: 1_725_000_006, payload: { kind: "spawned", agentPath: "ui-review" } },
  { id: "future-1", accountId: "bot3", threadId: "thread-1", turnId: "turn-1", type: "opaque", status: null, createdAt: 1_725_000_007, payload: { originalType: "futureItem", raw: { detail: "Retained safely" } } },
];

export function setViewport(width: number): void {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  window.dispatchEvent(new Event("resize"));
}
