export type SwarmErrorCode =
  | "ACCOUNT_AUTH_REQUIRED"
  | "ACCOUNT_OFFLINE"
  | "TASK_NOT_READY"
  | "RATE_LIMIT_WAIT"
  | "DANGEROUS_APPROVAL_REQUIRED"
  | "HUMAN_APPROVAL_REQUIRED"
  | "GIT_HANDOFF_PUSH_FAILED"
  | "MASTERPLAN_NOT_READY"
  | "FILE_OUTSIDE_WORKSPACE"
  | "AUTH_INVALID"
  | "MANIFEST_INVALID"
  | "MANIFEST_DUPLICATE_TASK_ID"
  | "MANIFEST_UNKNOWN_DEPENDENCY"
  | "MANIFEST_CYCLE";

export interface ApiError {
  code: SwarmErrorCode | (string & {});
  message: string;
  details?: unknown;
}

export type ApiResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: ApiError };
