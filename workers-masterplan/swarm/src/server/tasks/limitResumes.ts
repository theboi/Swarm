import type { AccountId, ChatExecutionSettings, LimitResumeRecord, LimitResumeState } from "../../shared/contracts.js";

export interface PendingLimitMessage {
  id: string;
  text: string;
  queuedAt: number;
  settings?: ChatExecutionSettings;
}

export interface DurableLimitResumeRecord extends LimitResumeRecord {
  pendingMessages?: PendingLimitMessage[];
  inFlightMessages?: PendingLimitMessage[];
  /** Exact options used by the turn that exhausted its usage limit. */
  turnSettings?: ChatExecutionSettings;
}

function key(accountId: AccountId, threadId: string): string { return `${accountId}\u0000${threadId}`; }

/** Errors proving this thread cannot or no longer needs to be auto-resumed. */
export function shouldRetireLimitResume(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /already has an active writer|session .* is archived|(?:direct app-server input is not allowed|cannot resume an unloaded).*multi-agent/i.test(message);
}

function clone(record: DurableLimitResumeRecord): DurableLimitResumeRecord {
  return {
    ...record,
    ...(record.pendingMessages ? { pendingMessages: record.pendingMessages.map((message) => ({ ...message, ...(message.settings ? { settings: { ...message.settings } } : {}) })) } : {}),
    ...(record.inFlightMessages ? { inFlightMessages: record.inFlightMessages.map((message) => ({ ...message, ...(message.settings ? { settings: { ...message.settings } } : {}) })) } : {}),
    ...(record.turnSettings ? { turnSettings: { ...record.turnSettings } } : {}),
  };
}

/** Owns durable usage-limit recovery state independently of worker/task assignment. */
export class LimitResumeManifest {
  private readonly records = new Map<string, DurableLimitResumeRecord>();

  constructor(initial: DurableLimitResumeRecord[] = [], private readonly persist: (records: DurableLimitResumeRecord[]) => Promise<void> = async () => undefined) {
    for (const record of initial) this.records.set(key(record.accountId, record.threadId), clone(record));
  }

  list(): DurableLimitResumeRecord[] { return [...this.records.values()].map(clone); }
  publicList(): LimitResumeRecord[] {
    return this.list().map(({ pendingMessages, inFlightMessages: _inFlightMessages, turnSettings: _turnSettings, ...record }) => ({
      ...record,
      ...(pendingMessages?.length ? { queuedMessageCount: pendingMessages.length } : {}),
    }));
  }
  forThread(accountId: AccountId, threadId: string): DurableLimitResumeRecord | undefined {
    const value = this.records.get(key(accountId, threadId));
    return value && clone(value);
  }
  isEnabled(accountId: AccountId, threadId: string): boolean {
    const record = this.records.get(key(accountId, threadId));
    return Boolean(record && record.state !== "transferred");
  }
  async setEnabled(accountId: AccountId, threadId: string, enabled: boolean, now = Date.now()): Promise<void> {
    const recordKey = key(accountId, threadId);
    const current = this.records.get(recordKey);
    if (current?.state === "transferred") return;
    if (enabled) {
      if (current) return;
      await this.mutate(() => { this.records.set(recordKey, { accountId, threadId, state: "armed", updatedAt: now }); });
      return;
    }
    await this.clear(accountId, threadId);
  }
  waitingForAccount(accountId: AccountId): DurableLimitResumeRecord[] {
    return [...this.records.values()].filter((record) => record.accountId === accountId && record.state === "waiting_for_limit").map(clone);
  }

  async markWaiting(accountId: AccountId, threadId: string, now = Date.now(), turnSettings?: ChatExecutionSettings): Promise<void> {
    const current = this.records.get(key(accountId, threadId));
    if (current && current.state !== "armed" && current.state !== "waiting_for_limit") return;
    await this.mutate(() => {
      this.records.set(key(accountId, threadId), {
        accountId,
        threadId,
        state: "waiting_for_limit",
        updatedAt: now,
        ...(current?.pendingMessages ? { pendingMessages: current.pendingMessages } : {}),
        ...(turnSettings || current?.turnSettings ? { turnSettings: { ...(turnSettings ?? current?.turnSettings) } } : {}),
      });
    });
  }

  async enqueueMessage(accountId: AccountId, threadId: string, message: PendingLimitMessage): Promise<boolean> {
    const record = this.records.get(key(accountId, threadId));
    if (!record || (record.state !== "waiting_for_limit" && record.state !== "resuming")) return false;
    await this.mutate(() => {
      record.pendingMessages ??= [];
      record.pendingMessages.push({ ...message, ...(message.settings ? { settings: { ...message.settings } } : {}) });
      record.updatedAt = Math.max(record.updatedAt, message.queuedAt);
    });
    return true;
  }

  resumeTurnInput(record: DurableLimitResumeRecord): { text: string; settings?: ChatExecutionSettings } {
    const messages = record.inFlightMessages ?? record.pendingMessages ?? [];
    const continuation = "Continue from where you stopped after the usage limit reset.";
    const text = messages.length
      ? `${continuation}\n\nMessages sent by the user while this chat was waiting:\n\n${messages.map((message, index) => `${index + 1}. ${message.text}`).join("\n\n")}`
      : continuation;
    const settings = [...messages].reverse().find((message) => message.settings)?.settings ?? record.turnSettings;
    return { text, ...(settings ? { settings: { ...settings } } : {}) };
  }

  queuedMessagesText(record: DurableLimitResumeRecord): string {
    const messages = record.pendingMessages ?? [];
    return messages.length ? `Messages sent by the user while this chat was waiting:\n\n${messages.map((message, index) => `${index + 1}. ${message.text}`).join("\n\n")}` : "";
  }

  async clear(accountId: AccountId, threadId: string): Promise<void> {
    if (!this.records.has(key(accountId, threadId))) return;
    await this.mutate(() => { this.records.delete(key(accountId, threadId)); });
  }

  async claimResume(accountId: AccountId, threadId: string, clientUserMessageId: string, now = Date.now()): Promise<DurableLimitResumeRecord | undefined> {
    const record = this.records.get(key(accountId, threadId));
    if (!record || record.state !== "waiting_for_limit") return undefined;
    await this.mutate(() => {
      record.state = "resuming";
      record.resumeClientUserMessageId = clientUserMessageId;
      record.inFlightMessages = record.pendingMessages ?? [];
      record.pendingMessages = [];
      record.updatedAt = now;
    });
    return this.forThread(accountId, threadId);
  }

  async restoreWaitingFromResume(accountId: AccountId, threadId: string, clientUserMessageId: string, now = Date.now()): Promise<void> {
    const record = this.records.get(key(accountId, threadId));
    if (!record || record.state !== "resuming" || record.resumeClientUserMessageId !== clientUserMessageId) return;
    await this.mutate(() => {
      record.state = "waiting_for_limit";
      record.pendingMessages = [...(record.inFlightMessages ?? []), ...(record.pendingMessages ?? [])];
      delete record.inFlightMessages;
      delete record.resumeClientUserMessageId;
      record.updatedAt = now;
    });
  }

  async recoverOrphanedResume(accountId: AccountId, threadId: string, now = Date.now()): Promise<void> {
    const record = this.records.get(key(accountId, threadId));
    if (!record || record.state !== "resuming" || record.resumeClientUserMessageId) return;
    await this.mutate(() => {
      record.state = "waiting_for_limit";
      record.pendingMessages = [...(record.inFlightMessages ?? []), ...(record.pendingMessages ?? [])];
      delete record.inFlightMessages;
      record.updatedAt = now;
    });
  }

  /** Completes only the accepted batch and reports whether newer messages remain queued. */
  async completeAcceptedResume(accountId: AccountId, threadId: string, clientUserMessageId: string, now = Date.now()): Promise<boolean> {
    const record = this.records.get(key(accountId, threadId));
    if (!record || record.state !== "resuming" || record.resumeClientUserMessageId !== clientUserMessageId) return false;
    if (!record.pendingMessages?.length) {
      await this.mutate(() => {
        record.state = "armed";
        delete record.inFlightMessages;
        delete record.resumeClientUserMessageId;
        record.updatedAt = now;
      });
      return false;
    }
    await this.mutate(() => {
      record.state = "waiting_for_limit";
      delete record.inFlightMessages;
      delete record.resumeClientUserMessageId;
      record.updatedAt = now;
    });
    return true;
  }

  async claimTransfer(accountId: AccountId, threadId: string, now = Date.now()): Promise<LimitResumeState | undefined> {
    const record = this.records.get(key(accountId, threadId));
    if (!record || record.state !== "waiting_for_limit") return undefined;
    const prior = record.state;
    await this.mutate(() => {
      record.state = "transferring";
      delete record.resumeClientUserMessageId;
      record.updatedAt = now;
    });
    return prior;
  }

  async restoreTransfer(accountId: AccountId, threadId: string, state: LimitResumeState, now = Date.now()): Promise<void> {
    const record = this.records.get(key(accountId, threadId));
    if (!record || record.state !== "transferring") return;
    await this.mutate(() => { record.state = state; record.updatedAt = now; });
  }

  async markTransferred(accountId: AccountId, threadId: string, now = Date.now()): Promise<void> {
    await this.mutate(() => {
      this.records.set(key(accountId, threadId), { accountId, threadId, state: "transferred", updatedAt: now });
    });
  }

  async completeTransfer(accountId: AccountId, threadId: string, now = Date.now()): Promise<void> { await this.markTransferred(accountId, threadId, now); }

  private async mutate(operation: () => void): Promise<void> {
    const prior = this.list();
    operation();
    try { await this.persist(this.list()); }
    catch (error) {
      this.records.clear();
      for (const record of prior) this.records.set(key(record.accountId, record.threadId), record);
      throw error;
    }
  }
}
