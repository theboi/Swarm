import type {
  ApiResult,
  ChatExecutionSettings,
  ChatModelOption,
  CoordinatorSnapshot,
  DispatchRecord,
  LaunchAccountOption,
  PendingApproval,
  TaskNode,
  ThreadSummary,
  TranscriptItem,
} from "../shared/contracts.js";

export interface LoginChallenge { challengeId: string; }
export interface SessionState { authenticated: boolean; }
export interface LaunchPreview {
  task: TaskNode;
  accountId: string;
  prompt: string;
  dependencies: string[];
  accounts?: LaunchAccountOption[];
}
export interface MarkdownDocument { filename: string; content: string; }

export interface CoordinatorApi {
  getSession(): Promise<SessionState>;
  getSnapshot(): Promise<CoordinatorSnapshot>;
  startLogin(input: { email: string; password: string }): Promise<ApiResult<LoginChallenge>>;
  completeLogin(input: { challengeId: string; code: string }): Promise<ApiResult<SessionState>>;
  previewLaunch(taskId: string, accountId?: string, pass?: "planning" | "execution"): Promise<ApiResult<LaunchPreview>>;
  launch(taskId: string, accountId: string, prompt?: string, settings?: ChatExecutionSettings, pass?: "planning" | "execution"): Promise<ApiResult<DispatchRecord>>;
  connectAccount(accountId: string): Promise<ApiResult<unknown>>;
  refreshAllRateLimits(): Promise<ApiResult<unknown>>;
  listModels(accountId: string): Promise<ApiResult<ChatModelOption[]>>;
  listThreads(accountId: string): Promise<ApiResult<ThreadSummary[]>>;
  openTerminal(accountId: string): Promise<ApiResult<unknown>>;
  startThread(accountId: string): Promise<ApiResult<ThreadSummary>>;
  moveThreadToAccount(sourceAccountId: string, threadId: string, targetAccountId: string, settings?: ChatExecutionSettings): Promise<ApiResult<ThreadSummary>>;
  renameThread(accountId: string, threadId: string, name: string): Promise<ApiResult<unknown>>;
  archiveThread(accountId: string, threadId: string): Promise<ApiResult<unknown>>;
  startTurn(accountId: string, threadId: string, text: string, settings?: ChatExecutionSettings): Promise<ApiResult<unknown>>;
  steerTurn(accountId: string, threadId: string, turnId: string, text: string): Promise<ApiResult<unknown>>;
  interruptTurn(accountId: string, threadId: string, turnId: string): Promise<ApiResult<unknown>>;
  readTranscript(accountId: string, threadId: string): Promise<ApiResult<TranscriptItem[]>>;
  readMarkdown(accountId: string, path: string): Promise<ApiResult<MarkdownDocument>>;
  decideApproval(approval: PendingApproval, decision: string, permissions?: Record<string, unknown>): Promise<ApiResult<unknown>>;
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const response = await fetch(`/api/v1${path}`, {
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...init?.headers },
    ...init,
  });
  const payload = await response.json() as ApiResult<T>;
  if (!response.ok && !("error" in payload)) throw new Error("Coordinator request failed");
  return payload;
}

async function read<T>(path: string): Promise<T> {
  const result = await request<T>(path);
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

function localTerminalControlOrigin(): string {
  const location = window.location;
  const dashboardPort = location.port ? Number(location.port) : location.protocol === "https:" ? 443 : 80;
  if (!Number.isInteger(dashboardPort) || dashboardPort < 1 || dashboardPort >= 65_535) {
    throw new Error("The local Swarm dashboard has an invalid port");
  }
  return `${location.protocol}//${location.hostname}:${dashboardPort + 1}`;
}

async function terminalRequest<T>(path: string): Promise<ApiResult<T>> {
  const response = await fetch(`${localTerminalControlOrigin()}/api/v1${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
  });
  const payload = await response.json() as ApiResult<T>;
  if (!response.ok && !("error" in payload)) throw new Error("Terminal controller request failed");
  return payload;
}

export function createHttpCoordinatorApi(): CoordinatorApi {
  return {
    getSession: () => read<SessionState>("/auth/session"),
    getSnapshot: () => read<CoordinatorSnapshot>("/snapshot"),
    startLogin: (input) => request<LoginChallenge>("/auth/challenge", { method: "POST", body: JSON.stringify(input) }),
    completeLogin: (input) => request<SessionState>("/auth/complete", { method: "POST", body: JSON.stringify(input) }),
    previewLaunch: (taskId, accountId, pass) => request<LaunchPreview>(`/tasks/${encodeURIComponent(taskId)}/preview`, { method: "POST", body: JSON.stringify({ ...(accountId ? { accountId } : {}), ...(pass ? { pass } : {}) }) }),
    launch: (taskId, accountId, prompt, settings, pass) => request<DispatchRecord>(`/tasks/${encodeURIComponent(taskId)}/launch`, { method: "POST", body: JSON.stringify({ accountId, ...(prompt ? { prompt } : {}), ...(settings ? { settings } : {}), ...(pass ? { pass } : {}) }) }),
    connectAccount: (accountId) => request<unknown>(`/accounts/${encodeURIComponent(accountId)}/connect`, { method: "POST" }),
    refreshAllRateLimits: () => request<unknown>("/accounts/rate-limits/refresh", { method: "POST" }),
    listModels: (accountId) => request<ChatModelOption[]>(`/accounts/${encodeURIComponent(accountId)}/models`),
    listThreads: (accountId) => request<ThreadSummary[]>(`/accounts/${encodeURIComponent(accountId)}/threads`),
    openTerminal: (accountId) => terminalRequest<unknown>(`/accounts/${encodeURIComponent(accountId)}/terminal`),
    startThread: (accountId) => request<ThreadSummary>(`/accounts/${encodeURIComponent(accountId)}/threads`, { method: "POST" }),
    moveThreadToAccount: (sourceAccountId, threadId, targetAccountId, settings) => request<ThreadSummary>(`/accounts/${encodeURIComponent(sourceAccountId)}/threads/${encodeURIComponent(threadId)}/move`, { method: "POST", body: JSON.stringify({ targetAccountId, ...(settings ? { settings } : {}) }) }),
    renameThread: (accountId, threadId, name) => request<unknown>(`/accounts/${encodeURIComponent(accountId)}/threads/${encodeURIComponent(threadId)}/name`, { method: "POST", body: JSON.stringify({ name }) }),
    archiveThread: (accountId, threadId) => request<unknown>(`/accounts/${encodeURIComponent(accountId)}/threads/${encodeURIComponent(threadId)}/archive`, { method: "POST" }),
    startTurn: (accountId, threadId, text, settings) => request<unknown>(`/accounts/${encodeURIComponent(accountId)}/threads/${encodeURIComponent(threadId)}/turns`, { method: "POST", body: JSON.stringify({ text, ...(settings ? { settings } : {}) }) }),
    steerTurn: (accountId, threadId, turnId, text) => request<unknown>(`/accounts/${encodeURIComponent(accountId)}/threads/${encodeURIComponent(threadId)}/steer`, { method: "POST", body: JSON.stringify({ turnId, text }) }),
    interruptTurn: (accountId, threadId, turnId) => request<unknown>(`/accounts/${encodeURIComponent(accountId)}/threads/${encodeURIComponent(threadId)}/interrupt`, { method: "POST", body: JSON.stringify({ turnId }) }),
    readTranscript: (accountId, threadId) => request<TranscriptItem[]>(`/accounts/${encodeURIComponent(accountId)}/threads/${encodeURIComponent(threadId)}`),
    readMarkdown: (accountId, path) => request<MarkdownDocument>(`/accounts/${encodeURIComponent(accountId)}/files/read`, { method: "POST", body: JSON.stringify({ path }) }),
    decideApproval: (approval, decision, permissions) => request<unknown>(`/approvals/${encodeURIComponent(approval.id)}`, { method: "POST", body: JSON.stringify({ decision, ...(permissions ? { permissions } : {}) }) }),
  };
}
