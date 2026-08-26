import type { ApiResult } from "./errors.js";

export type AccountId =
  | "bot1"
  | "bot2"
  | "bot3"
  | "bot4"
  | "bot5"
  | "bot6"
  | "bot7"
  | "bot8";

export type AccountConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "action_required"
  | "error";

export type AccountAuthenticationState =
  | "unknown"
  | "authenticated"
  | "unauthenticated";

export interface RateLimitWindow {
  id: string;
  label: string;
  usedPercent: number | null;
  resetsAt: number | null;
  updatedAt: number;
}

export interface AccountSnapshot {
  id: AccountId;
  connection: AccountConnectionState;
  authentication: AccountAuthenticationState;
  rateLimits: RateLimitWindow[];
  activeTurns: number;
  lastAssignedAt: number | null;
  terminalCommand?: string;
  errorCode?: string;
}

export type TaskKind = "planning" | "execution" | "ui" | "gate";
export type PromptTemplate = "planning" | "execution" | "ui";

export interface TaskManifestTask {
  id: string;
  title: string;
  kind: TaskKind;
  dependsOn: string[];
  pathId?: string;
  pathStep?: number;
  statusPath?: string;
  specificationPath?: string;
  implementationPlanPath?: string;
  promptTemplate: PromptTemplate;
  preferredAccount?: AccountId;
}

export interface TaskManifest {
  blueprintId: string;
  title: string;
  masterplanPath: string;
  coordinationRoot: string;
  tasks: TaskManifestTask[];
}

export type TaskPhase = "planning" | "execution" | "ui" | "gate";
export type TaskState =
  | "not_ready"
  | "ready"
  | "queued"
  | "running"
  | "blocked"
  | "complete"
  | "attention_required";

export interface ReadinessEvidence {
  code: string;
  satisfied: boolean;
  path?: string;
  commit?: string;
  details?: string;
}

export interface TaskReadiness {
  taskId: string;
  state: TaskState;
  phase: TaskPhase;
  evidence: ReadinessEvidence[];
  blockingCodes: string[];
  suggestedAccount?: AccountId;
}

export interface TaskNode extends TaskManifestTask {
  readiness: TaskReadiness;
}

export type DispatchState =
  | "queued"
  | "submitting"
  | "accepted"
  | "waiting_for_limit"
  | "completed"
  | "failed"
  | "attention_required";

export interface DispatchRecord {
  id: string;
  clientUserMessageId: string;
  taskId: string;
  accountId: AccountId;
  threadId: string;
  state: DispatchState;
  createdAt: number;
  updatedAt: number;
  retryAt: number | null;
  errorCode?: string;
}

export interface ThreadCapabilities {
  canArchive: boolean;
  canInterrupt: boolean;
  canStartTurn: boolean;
  canSteer: boolean;
}

export interface ThreadSummary {
  id: string;
  accountId: AccountId;
  name: string | null;
  archived: boolean;
  updatedAt: number;
  capabilities: ThreadCapabilities;
}

export interface TranscriptItem {
  id: string;
  accountId: AccountId;
  threadId: string;
  turnId: string | null;
  type: string;
  status: string | null;
  createdAt: number | null;
  payload: Record<string, unknown>;
}

export interface PendingApproval {
  id: string;
  accountId: AccountId;
  threadId: string;
  turnId: string | null;
  itemId: string | null;
  method: string;
  summary: string;
  availableDecisions: string[];
  createdAt: number;
}

export interface HealthComponent {
  state: "ok" | "degraded" | "error";
  message?: string;
}

export interface HealthSnapshot {
  server: HealthComponent;
  stateStore: HealthComponent;
  readiness: HealthComponent;
  outbox: HealthComponent;
  scheduler: HealthComponent;
  ngrok: HealthComponent;
  accounts: HealthComponent;
}

export interface NgrokSnapshot {
  state: "disabled" | "stopped" | "starting" | "running" | "error";
  publicUrl: string | null;
  message: string | null;
  nextBoundaryAt: number | null;
}

export interface CoordinatorSnapshot {
  generatedAt: number;
  activeTurnLimit: number;
  accounts: AccountSnapshot[];
  tasks: TaskNode[];
  dispatches: DispatchRecord[];
  threads: ThreadSummary[];
  pendingApprovals: PendingApproval[];
  ngrok: NgrokSnapshot;
  health: HealthSnapshot;
}

export interface CoordinatorEvent {
  sequence: number;
  type: string;
  occurredAt: number;
  payload: Record<string, unknown>;
}

export type { ApiResult };
export { validateTaskManifest } from "./manifest.js";
export type { ManifestValidationError, ManifestValidationResult } from "./manifest.js";
