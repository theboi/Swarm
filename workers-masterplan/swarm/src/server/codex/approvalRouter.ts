import type { PendingApproval } from "../../shared/contracts.js";
import {
  buildApprovalResponse,
  classifyApproval,
  type ApprovalChoice,
  type ApprovalClassification,
  type ApprovalContext,
  type ApprovalRequest,
} from "../safety/approvalPolicy.js";
import { isApprovalMethod, safeApprovalDecline, type ApprovalMethod, type JsonRpcRequest } from "./protocol.js";

export interface ApprovalJournalEntry {
  pending: PendingApproval;
  requestId: string;
  classification: ApprovalClassification;
  normalizedTargets: string[];
  summary: string;
  offeredChoices: string[];
  actor: "auto" | "human" | "timeout" | "error";
  chosenResponse?: Record<string, unknown>;
  sendOutcome: "pending" | "response_ready" | "safe_decline";
}

/** Dependency boundary for Task 1's durable pending-approval state and UI queue. */
export interface ApprovalJournal {
  append(entry: ApprovalJournalEntry): Promise<void>;
  waitForDecision(entry: ApprovalJournalEntry): Promise<ApprovalChoice>;
}

export interface ApprovalRouterOptions {
  context: ApprovalContext;
  journal: ApprovalJournal;
  requestTimeoutMs?: number;
  now?: () => number;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function protocolChoices(method: ApprovalMethod): string[] {
  switch (method) {
    case "item/commandExecution/requestApproval": return ["decline", "cancel"];
    case "item/fileChange/requestApproval": return ["decline", "cancel"];
    case "item/permissions/requestApproval": return ["grant"];
    case "execCommandApproval": return ["accept", "decline", "cancel"];
    case "applyPatchApproval": return ["accept", "decline", "cancel"];
  }
}

function autoChoice(method: ApprovalMethod): ApprovalChoice {
  return method === "item/permissions/requestApproval"
    ? { kind: "grant", permissions: {}, scope: "turn" }
    : { kind: "accept" };
}

/** One fail-closed policy boundary for every app-server approval server request. */
export class ApprovalRouter {
  private readonly now: () => number;

  constructor(private readonly options: ApprovalRouterOptions) {
    this.now = options.now ?? Date.now;
  }

  async handle(request: JsonRpcRequest): Promise<Record<string, unknown>> {
    if (!isApprovalMethod(request.method)) throw new Error("Approval router received a non-approval method");
    const method = request.method;
    const params = record(request.params);
    const policyRequest: ApprovalRequest = { method, params };
    const classification = await classifyApproval(policyRequest, this.options.context);
    const base = this.entry(request, method, params, classification, "error", "pending");

    if (classification.outcome === "auto_accept") {
      const response = buildApprovalResponse(policyRequest, autoChoice(method), this.options.context);
      await this.options.journal.append({ ...base, actor: "auto", chosenResponse: response, sendOutcome: "response_ready" });
      return response;
    }

    if (classification.outcome === "decline") {
      const response = safeApprovalDecline(method);
      await this.options.journal.append({ ...base, actor: "error", chosenResponse: response, sendOutcome: "safe_decline" });
      return response;
    }

    const pending = { ...base, actor: "error" as const, sendOutcome: "pending" as const };
    await this.options.journal.append(pending);
    try {
      const choice = await this.withDeadline(this.options.journal.waitForDecision(pending));
      const response = buildApprovalResponse(policyRequest, choice, this.options.context);
      await this.options.journal.append({ ...base, actor: "human", chosenResponse: response, sendOutcome: "response_ready" });
      return response;
    } catch {
      const response = safeApprovalDecline(method);
      await this.options.journal.append({ ...base, actor: "timeout", chosenResponse: response, sendOutcome: "safe_decline" });
      return response;
    }
  }

  private entry(
    request: JsonRpcRequest,
    method: ApprovalMethod,
    params: Record<string, unknown>,
    classification: ApprovalClassification,
    actor: ApprovalJournalEntry["actor"],
    sendOutcome: ApprovalJournalEntry["sendOutcome"],
  ): ApprovalJournalEntry {
    const threadId = asString(params.threadId) ?? asString(params.conversationId) ?? "unknown";
    const turnId = asString(params.turnId);
    const itemId = asString(params.itemId);
    const requestId = String(request.id);
    const pending: PendingApproval = {
      id: asString(params.approvalId) ?? requestId,
      accountId: this.options.context.account,
      threadId,
      turnId,
      itemId,
      method,
      summary: `${method}: ${classification.reason}`.slice(0, 512),
      availableDecisions: protocolChoices(method),
      createdAt: this.now(),
    };
    return {
      pending,
      requestId,
      classification,
      normalizedTargets: [...classification.targets],
      summary: pending.summary,
      offeredChoices: [...pending.availableDecisions],
      actor,
      sendOutcome,
    };
  }

  private withDeadline<T>(operation: Promise<T>): Promise<T> {
    const timeoutMs = this.options.requestTimeoutMs ?? 30_000;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Human approval timed out")), timeoutMs);
      timer.unref();
      operation.then(
        (value) => { clearTimeout(timer); resolve(value); },
        (error) => { clearTimeout(timer); reject(error instanceof Error ? error : new Error(String(error))); },
      );
    });
  }
}
