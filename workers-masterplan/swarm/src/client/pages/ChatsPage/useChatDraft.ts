import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const unavailableStorageDrafts = new Map<string, string>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** Account and thread identity keep main, new-chat and subagent drafts independent. */
export function useChatDraft(accountId: string | null, threadId: string | null): readonly [string, (text: string) => void] {
  const key = `swarm.chat.draft.v1:${JSON.stringify([accountId, threadId])}`;
  const draft = useSyncExternalStore(subscribe, () => {
    try { return unavailableStorageDrafts.get(key) ?? window.localStorage.getItem(key) ?? ""; }
    catch { return unavailableStorageDrafts.get(key) ?? ""; }
  }, () => "");
  const setDraft = (text: string) => {
    if (!accountId) return;
    try {
      if (text) window.localStorage.setItem(key, text);
      else window.localStorage.removeItem(key);
      unavailableStorageDrafts.delete(key);
    } catch {
      // Retain navigation persistence even when browser storage is blocked or full.
      unavailableStorageDrafts.set(key, text);
    }
    listeners.forEach((listener) => listener());
  };
  return [draft, setDraft];
}
