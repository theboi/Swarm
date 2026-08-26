import type {
  ApiResult,
  CoordinatorSnapshot,
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
  concurrencyImpact: string;
}
export interface MarkdownDocument { filename: string; content: string; }

export interface CoordinatorApi {
  getSession(): Promise<SessionState>;
  getSnapshot(): Promise<CoordinatorSnapshot>;
  startLogin(input: { email: string; password: string }): Promise<ApiResult<LoginChallenge>>;
  completeLogin(input: { challengeId: string; code: string }): Promise<ApiResult<SessionState>>;
  previewLaunch(taskId: string): Promise<ApiResult<LaunchPreview>>;
  launch(taskId: string, accountId: string): Promise<ApiResult<unknown>>;
  startThread(accountId: string): Promise<ApiResult<ThreadSummary>>;
  archiveThread(accountId: string, threadId: string): Promise<ApiResult<unknown>>;
  startTurn(accountId: string, threadId: string, text: string): Promise<ApiResult<unknown>>;
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

export function createHttpCoordinatorApi(): CoordinatorApi {
  return {
    getSession: () => read<SessionState>("/auth/session"),
    getSnapshot: () => read<CoordinatorSnapshot>("/snapshot"),
    startLogin: (input) => request<LoginChallenge>("/auth/challenge", { method: "POST", body: JSON.stringify(input) }),
    completeLogin: (input) => request<SessionState>("/auth/complete", { method: "POST", body: JSON.stringify(input) }),
    previewLaunch: (taskId) => request<LaunchPreview>(`/tasks/${encodeURIComponent(taskId)}/preview`, { method: "POST" }),
    launch: (taskId, accountId) => request<unknown>(`/tasks/${encodeURIComponent(taskId)}/launch`, { method: "POST", body: JSON.stringify({ accountId }) }),
    startThread: (accountId) => request<ThreadSummary>(`/accounts/${encodeURIComponent(accountId)}/threads`, { method: "POST" }),
    archiveThread: (accountId, threadId) => request<unknown>(`/accounts/${encodeURIComponent(accountId)}/threads/${encodeURIComponent(threadId)}/archive`, { method: "POST" }),
    startTurn: (accountId, threadId, text) => request<unknown>(`/accounts/${encodeURIComponent(accountId)}/threads/${encodeURIComponent(threadId)}/turns`, { method: "POST", body: JSON.stringify({ text }) }),
    steerTurn: (accountId, threadId, turnId, text) => request<unknown>(`/accounts/${encodeURIComponent(accountId)}/threads/${encodeURIComponent(threadId)}/steer`, { method: "POST", body: JSON.stringify({ turnId, text }) }),
    interruptTurn: (accountId, threadId, turnId) => request<unknown>(`/accounts/${encodeURIComponent(accountId)}/threads/${encodeURIComponent(threadId)}/interrupt`, { method: "POST", body: JSON.stringify({ turnId }) }),
    readTranscript: (accountId, threadId) => request<TranscriptItem[]>(`/accounts/${encodeURIComponent(accountId)}/threads/${encodeURIComponent(threadId)}`),
    readMarkdown: (accountId, path) => request<MarkdownDocument>(`/accounts/${encodeURIComponent(accountId)}/files/read`, { method: "POST", body: JSON.stringify({ path }) }),
    decideApproval: (approval, decision, permissions) => request<unknown>(`/approvals/${encodeURIComponent(approval.id)}`, { method: "POST", body: JSON.stringify({ decision, ...(permissions ? { permissions } : {}) }) }),
  };
}
