import { useEffect, useRef, useState } from "react";
import { EdenDropdown } from "@/components/primitives/EdenDropdown";
import { EdenButton } from "@/components/primitives/EdenButton/EdenButton";
import type { AccountId } from "../../../../shared/contracts.js";
import { isBotProfileAccountId, isMacosBotId } from "../../../../shared/contracts.js";
import type { CoordinatorApi } from "../../../api.js";
import { useCoordinatorStore } from "../../../store/coordinatorStore.js";
import styles from "../styles.module.scss";

export function SendTodo({ api, description, onSent, onBusyChange }: { api: CoordinatorApi; description: string; onSent: (target: { accountId: AccountId; threadId: string }) => void; onBusyChange: (busy: boolean) => void }) {
  const { snapshot } = useCoordinatorStore();
  const bots = snapshot?.accounts.filter(account => isBotProfileAccountId(account.id) || isMacosBotId(account.id)) ?? [];
  const available = (id: string) => bots.some(bot => bot.id === id && bot.connection === "connected" && bot.authentication === "authenticated");
  const [accountId, setAccountId] = useState(bots.find(bot => available(bot.id))?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [accountLocked, setAccountLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target = useRef<{ threadId?: string; messageId: string }>({ messageId: crypto.randomUUID() });
  const running = useRef(false);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  async function send() {
    if (running.current || !available(accountId)) return;
    running.current = true; setBusy(true); onBusyChange(true); setError(null);
    try {
      if (!target.current.threadId) {
        const result = await api.startThread(accountId);
        if (!live.current) return;
        if (result.error) throw new Error(result.error.message);
        target.current.threadId = result.data.id;
        setAccountLocked(true);
      }
      const threadId = target.current.threadId;
      const result = await api.startTurn(accountId, threadId, description, undefined, target.current.messageId);
      if (result.error) throw new Error(result.error.message);
      if (live.current) onSent({ accountId: accountId as AccountId, threadId });
    } catch (error) { setError(`Unable to send. ${error instanceof Error ? error.message : "Retry to use the same chat."}`); }
    finally { running.current = false; if (live.current) { setBusy(false); onBusyChange(false); } }
  }
  return <form className={styles.form} onSubmit={event => { event.preventDefault(); void send(); }}>
    <EdenDropdown label="Bot" portalled clearable={false} values={accountId ? [accountId] : []} disabled={busy || accountLocked} options={[{ items: bots.map(bot => ({ value: bot.id, label: `${bot.id}${available(bot.id) ? "" : " — unavailable"}`, disabled: !available(bot.id) })) }]} onChange={([id]) => setAccountId(id as AccountId)} />
    {error && <div role="alert">{error}</div>}
    <EdenButton density="compact" appearance="primary" isFloating={false} type="submit" disabled={busy || !available(accountId)}>{busy ? "Sending…" : "Send"}</EdenButton>
  </form>;
}
