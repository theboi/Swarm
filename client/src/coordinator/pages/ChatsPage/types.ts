import type { CoordinatorApi } from "../../api.js";

export type ChatsApi = Pick<CoordinatorApi, "readTranscript" | "readMarkdown" | "listModels" | "listThreads" | "startTurn" | "startThread" | "archiveThread" | "steerTurn" | "interruptTurn" | "decideApproval" | "setLimitResumeEnabled"> & Partial<Pick<CoordinatorApi, "moveThreadToAccount" | "renameThread">>;
export interface SubagentReference {
  threadId: string;
  label: string;
  active: boolean;
}
