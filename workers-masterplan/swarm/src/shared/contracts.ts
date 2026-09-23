import type { ApiResult } from "./errors.js";

export const BOT_ACCOUNT_IDS = ["bot1", "bot2", "bot3", "bot4", "bot5", "bot6", "bot7", "bot8"] as const;
export type BotAccountId = (typeof BOT_ACCOUNT_IDS)[number];
export const LOCAL_ACCOUNT_ID = "claudiothe" as const;
export const ACCOUNT_IDS = [LOCAL_ACCOUNT_ID, ...BOT_ACCOUNT_IDS] as const;
export type AccountId = (typeof ACCOUNT_IDS)[number];

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

export interface GitSyncStatus {
  state: "idle" | "ok" | "warning";
  action: "pull" | "push";
  lastAttemptAt: number | null;
  message?: string;
  errorCode?: "MERGE_CONFLICT";
}

export interface LocalWorkspaceSnapshot {
  label: string;
  gitSync: GitSyncStatus;
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
  gitSync?: GitSyncStatus;
  /** A worker explicitly reported a breaking change in this account's chat. */
  hasBreakingChange?: boolean;
}

export type TaskKind = "planning" | "execution" | "ui" | "gate";
export type PromptTemplate = "planning" | "execution" | "ui";
export type ManifestPass = "planning" | "execution";

export interface TaskManifestLifecycle {
  mode: "two_pass";
  activePass: ManifestPass;
  planningGatePath: string;
  /** True permits pass overlap; false requires the global planning gate before execution. */
  parallelPasses?: boolean;
}

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
  uiRequirementsPath?: string;
  uiHandoffPath?: string;
  promptTemplate: PromptTemplate;
  /** Stable lifecycle passes owned by this worker ID. UI-design workers exist only in Pass 1. */
  passes?: ManifestPass[];
  /** Hard implemented predecessors used when this stable worker ID advances to Pass 2. */
  executionDependsOn?: string[];
  preferredAccount?: AccountId;
}

export interface TaskManifest {
  blueprintId: string;
  title: string;
  masterplanPath: string;
  coordinationRoot: string;
  lifecycle?: TaskManifestLifecycle;
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

export interface AutoPilotState {
  enabled: boolean;
}

export type DispatchOrigin = "operator" | "auto_pilot";

export interface DispatchRecord {
  id: string;
  clientUserMessageId: string;
  taskId: string;
  pass?: ManifestPass;
  accountId: AccountId;
  threadId: string;
  state: DispatchState;
  createdAt: number;
  updatedAt: number;
  retryAt: number | null;
  /** Omitted for dispatches stored before launch provenance was introduced. */
  origin?: DispatchOrigin;
  errorCode?: string;
  /** Selected turn settings retained if a rate-limited launch must be retried. */
  settings?: ChatExecutionSettings;
}

export type WorkerAssignmentState = "assigned" | "waiting_for_limit" | "resuming" | "transferring" | "completed" | "attention_required";

export interface WorkerTransferRecord {
  fromAccountId: AccountId;
  fromThreadId: string;
  toAccountId: AccountId;
  toThreadId: string;
  transferredAt: number;
}

/** Durable ownership manifest for one blueprint worker across account transfers. */
export interface WorkerAssignmentRecord {
  taskId: string;
  pass?: ManifestPass;
  accountId: AccountId;
  threadId: string;
  state: WorkerAssignmentState;
  assignedAt: number;
  updatedAt: number;
  /** Stable idempotency key retained while a limit-resume turn is being reconciled. */
  resumeClientUserMessageId?: string;
  transferHistory: WorkerTransferRecord[];
}

export type LimitResumeState = "armed" | "waiting_for_limit" | "resuming" | "transferring" | "transferred";

/** Durable recovery state for any chat whose active turn stopped at an account usage limit. */
export interface LimitResumeRecord {
  accountId: AccountId;
  threadId: string;
  state: LimitResumeState;
  updatedAt: number;
  /** Number of messages durably queued while this chat waits for its usage limit. */
  queuedMessageCount?: number;
  /** Stable idempotency key retained while a limit-resume turn is being reconciled. */
  resumeClientUserMessageId?: string;
}

export interface ThreadCapabilities {
  canArchive: boolean;
  canInterrupt: boolean;
  canStartTurn: boolean;
  canSteer: boolean;
}

/** Deliberate execution boundary selected by the dashboard operator for the next turn. */
export type ChatPermissionMode = "ask_for_approval" | "ask_me" | "full_access";

/** Model and execution overrides supported by Codex for a turn and later turns in that chat. */
export interface ChatExecutionSettings {
  model?: string;
  effort?: string;
  serviceTier?: string;
  permissionMode?: ChatPermissionMode;
}

/** A model option normalized from the signed-in account's Codex model catalog. */
export interface ChatModelOption {
  model: string;
  displayName: string;
  supportedEfforts: string[];
  defaultEffort: string | null;
  serviceTiers: Array<{ id: string; name: string }>;
  defaultServiceTier: string | null;
  isDefault: boolean;
}

export interface ThreadSummary {
  id: string;
  accountId: AccountId;
  name: string | null;
  archived: boolean;
  /** True only when the app-server thread's working directory is this account's EdenMind clone. */
  isEdenMindProject?: boolean;
  updatedAt: number;
  /** Current app-server activity, retained so a missed browser event cannot hide a running turn. */
  activity?: "active" | "idle";
  /** Active turn recovered from a desktop-owned rollout when this app-server did not start it. */
  activeTurnId?: string;
  capabilities: ThreadCapabilities;
}

export interface LaunchAccountOption {
  id: AccountId;
  activeWorkers: number;
  available: boolean;
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
  /** Exact permissions requested by the app server; grants are disabled when absent. */
  requestedPermissions?: Record<string, unknown>;
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
  accounts: HealthComponent;
}

export interface CoordinatorSnapshot {
  generatedAt: number;
  autoPilot: AutoPilotState;
  accounts: AccountSnapshot[];
  localWorkspace?: LocalWorkspaceSnapshot;
  tasks: TaskNode[];
  taskPasses?: Partial<Record<ManifestPass, TaskNode[]>>;
  dispatches: DispatchRecord[];
  workerAssignments?: WorkerAssignmentRecord[];
  limitResumes?: LimitResumeRecord[];
  threads: ThreadSummary[];
  pendingApprovals: PendingApproval[];
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
