import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ACCOUNT_IDS,
  isBotProfileAccountId,
  type AccountId,
  type ChatExecutionSettings,
  type CoordinatorSnapshot,
} from "../../../shared/contracts.js";
import type { CoordinatorApi } from "../../api.js";
import { queuedTurnFromStart, turnIdFromStart } from "./turnStart.js";

type QueuedMessage = {
  id: string;
  accountId: AccountId;
  threadId: string;
  text: string;
  settings: ChatExecutionSettings;
  state: "queued" | "sending" | "failed";
  error?: string;
};
const STORAGE_KEY = "swarm.chat.queue.v1";
const listeners = new Set<() => void>();
const inFlight = new Set<string>();
const jobs = new Set<Promise<void>>();
let fallback: string | undefined;

function read(): string {
  try {
    return fallback ?? localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return fallback ?? "[]";
  }
}
function decode(raw: string): QueuedMessage[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is QueuedMessage =>
        entry &&
        typeof entry === "object" &&
        typeof entry.id === "string" &&
        typeof entry.accountId === "string" &&
        (ACCOUNT_IDS.some((id) => id === entry.accountId) ||
          isBotProfileAccountId(entry.accountId)) &&
        typeof entry.threadId === "string" &&
        typeof entry.text === "string" &&
        entry.settings &&
        typeof entry.settings === "object" &&
        ["queued", "sending", "failed"].includes(entry.state),
    );
  } catch {
    return [];
  }
}
function change(update: (entries: QueuedMessage[]) => QueuedMessage[]) {
  const raw = JSON.stringify(update(decode(read())));
  try {
    localStorage.setItem(STORAGE_KEY, raw);
    fallback = undefined;
  } catch {
    fallback = raw;
  }
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
export function useMessageQueue() {
  const raw = useSyncExternalStore(subscribe, read, () => "[]");
  return useMemo(() => decode(raw), [raw]);
}
export function enqueueMessage(
  accountId: AccountId,
  threadId: string,
  text: string,
  settings: ChatExecutionSettings,
): string {
  const id =
    crypto.randomUUID?.() ??
    Array.from(crypto.getRandomValues(new Uint32Array(4)), (word) =>
      word.toString(16).padStart(8, "0"),
    ).join("");
  change((entries) => [
    ...entries,
    { id, accountId, threadId, text, settings, state: "queued" },
  ]);
  return id;
}
export function removeMessage(id: string) {
  change((entries) =>
    entries.filter((entry) => entry.id !== id || entry.state === "sending"),
  );
}
export function retryMessage(id: string) {
  change((entries) =>
    entries.map((entry) =>
      entry.id === id && entry.state === "failed"
        ? { ...entry, state: "queued", error: undefined }
        : entry,
    ),
  );
}
function updateMessage(id: string, update: Partial<QueuedMessage>) {
  change((entries) =>
    entries.map((entry) => (entry.id === id ? { ...entry, ...update } : entry)),
  );
}

function useDeliveryOwner() {
  const [owner, setOwner] = useState(false);
  useEffect(() => {
    if (!navigator.locks) return;
    let disposed = false;
    let pending = false;
    let release: (() => void) | undefined;
    const claim = async () => {
      if (disposed || pending) return;
      pending = true;
      try {
        await navigator.locks.request(
          "swarm.chat.queue.delivery",
          { ifAvailable: true },
          async (lock) => {
            if (!lock || disposed) return;
            setOwner(true);
            await new Promise<void>((resolve) => {
              release = resolve;
            });
            if (!disposed) setOwner(false);
          },
        );
      } finally {
        pending = false;
      }
    };
    void claim();
    const timer = window.setInterval(() => {
      void claim();
    }, 1000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      // A surviving request still owns delivery even after logout/unmount.
      void Promise.allSettled([...jobs]).then(() => release?.());
    };
  }, []);
  return owner;
}

/** Lives at the signed-in app boundary, so changing pages does not stop delivery. */
export function useMessageQueueDelivery({
  snapshot,
  activeTurnKeys,
  limitExhaustedTurnKeys,
  api,
  markTurnActive,
  refresh,
  isTurnSettled = () => false,
}: {
  snapshot: CoordinatorSnapshot | null;
  activeTurnKeys: ReadonlySet<string>;
  limitExhaustedTurnKeys: ReadonlySet<string>;
  api: Pick<CoordinatorApi, "startTurn">;
  markTurnActive: (
    accountId: string,
    threadId: string,
    turnId?: string,
  ) => void;
  refresh: () => Promise<void>;
  isTurnSettled?: (
    accountId: string,
    threadId: string,
    turnId: string,
  ) => boolean;
}) {
  const entries = useMessageQueue();
  const owner = useDeliveryOwner();
  const awaitingResponse = useRef(
    new Map<
      string,
      {
        accountId: string;
        threadId: string;
        turnId?: string;
        observedActive: boolean;
      }
    >(),
  );
  useEffect(() => {
    if (!snapshot) return;
    if (!navigator.locks) {
      for (const entry of entries)
        if (entry.state === "queued")
          updateMessage(entry.id, {
            state: "failed",
            error:
              "Automatic queue delivery requires HTTPS or localhost and a browser with Web Locks. Your message is saved; remove it to send manually.",
          });
      return;
    }
    if (!owner) return;
    const busy = (key: string) =>
      activeTurnKeys.has(key) ||
      snapshot.threads.some(
        (thread) =>
          `${thread.accountId}\u0000${thread.id}` === key &&
          thread.activity === "active",
      );
    for (const [key, pending] of awaitingResponse.current) {
      if (
        pending.turnId &&
        isTurnSettled(pending.accountId, pending.threadId, pending.turnId)
      )
        awaitingResponse.current.delete(key);
      else if (busy(key)) pending.observedActive = true;
      else if (pending.observedActive) awaitingResponse.current.delete(key);
    }
    const seen = new Set<string>();
    for (const entry of entries) {
      const key = `${entry.accountId}\u0000${entry.threadId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (entry.state === "sending" && !inFlight.has(entry.id)) {
        updateMessage(entry.id, {
          state: "failed",
          error: "Delivery was interrupted. Check the chat before retrying.",
        });
        continue;
      }
      const account = snapshot.accounts.find(
        (account) => account.id === entry.accountId,
      );
      const thread = snapshot.threads.find(
        (thread) =>
          thread.accountId === entry.accountId && thread.id === entry.threadId,
      );
      const waiting = snapshot.limitResumes?.some(
        (record) =>
          record.accountId === entry.accountId &&
          record.threadId === entry.threadId &&
          ["waiting_for_limit", "resuming", "transferring"].includes(
            record.state,
          ),
      );
      if (
        entry.state !== "queued" ||
        inFlight.has(entry.id) ||
        awaitingResponse.current.has(key) ||
        busy(key) ||
        !thread ||
        thread.archived ||
        !account ||
        account.connection !== "connected" ||
        account.authentication !== "authenticated" ||
        limitExhaustedTurnKeys.has(key) ||
        waiting ||
        snapshot.pendingApprovals.some(
          (approval) =>
            approval.accountId === entry.accountId &&
            approval.threadId === entry.threadId,
        )
      )
        continue;
      inFlight.add(entry.id);
      updateMessage(entry.id, { state: "sending", error: undefined });
      const job = (async () => {
        try {
          const result = await api.startTurn(
            entry.accountId,
            entry.threadId,
            entry.text,
            entry.settings,
            entry.id,
          );
          if ("error" in result && result.error) {
            updateMessage(entry.id, {
              state: "failed",
              error: result.error.message,
            });
            return;
          }
          const turnId = turnIdFromStart(result.data);
          if (
            !turnId ||
            !isTurnSettled(entry.accountId, entry.threadId, turnId)
          ) {
            awaitingResponse.current.set(key, {
              accountId: entry.accountId,
              threadId: entry.threadId,
              turnId,
              observedActive: false,
            });
            if (!queuedTurnFromStart(result.data) && turnId)
              markTurnActive(entry.accountId, entry.threadId, turnId);
          }
          change((current) =>
            current.filter((message) => message.id !== entry.id),
          );
          await refresh();
        } catch {
          updateMessage(entry.id, {
            state: "failed",
            error:
              "Unable to confirm delivery. Check the chat before retrying.",
          });
        } finally {
          inFlight.delete(entry.id);
        }
      })();
      jobs.add(job);
      void job.finally(() => jobs.delete(job));
    }
  }, [
    entries,
    snapshot,
    activeTurnKeys,
    limitExhaustedTurnKeys,
    api,
    markTurnActive,
    refresh,
    isTurnSettled,
    owner,
  ]);
}
