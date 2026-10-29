import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CircleStop, CornerUpRight, Send } from "lucide-react";
import type { AccountId, ChatExecutionSettings, ChatModelOption, TranscriptItem } from "../../../shared/contracts.js";
import { OverlayCloseButton } from "../../components/OverlayCloseButton.js";
import { TranscriptTurns, reconcileTranscript } from "../../components/TranscriptTurns.js";
import { TurnOptions } from "../../components/TurnOptions.js";
import { normalizeExecutionSettings } from "../../turnSettings.js";
import type { ChatsApi, SubagentReference } from "./types.js";
import { turnIdFromStart } from "./turnStart.js";
export function SubagentChatDialog({ accountId, reference, api, models, settings, activeTurnKeys, activeTurnIds, markTurnActive, onSettingsChange, onTranscript, onOpenMarkdown, onClose, report, reportError }: {
  accountId: AccountId;
  reference: SubagentReference;
  api: ChatsApi;
  models: ChatModelOption[];
  settings: ChatExecutionSettings;
  activeTurnKeys: ReadonlySet<string>;
  activeTurnIds: ReadonlyMap<string, string>;
  markTurnActive: (accountId: string, threadId: string, turnId?: string) => void;
  onSettingsChange: (settings: ChatExecutionSettings) => void;
  onTranscript: (threadId: string, items: TranscriptItem[]) => void;
  onOpenMarkdown: (path: string) => void;
  onClose: () => void;
  report: (message: string) => void;
  reportError: (message: string) => void;
}) {
  const [items, setItems] = useState<TranscriptItem[]>([]);
  const [draft, setDraft] = useState("");
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const opened = useRef(false);
  const key = `${accountId}\u0000${reference.threadId}`;
  const thinking = activeTurnKeys.has(key);
  const latestTurnId = activeTurnIds.get(key) ?? [...items].reverse().find((item) => item.turnId)?.turnId ?? undefined;

  useEffect(() => {
    let live = true;
    let timer: number | undefined;
    const read = async () => {
      try {
        const result = await api.readTranscript(accountId, reference.threadId);
        if (!live) return;
        setLoading(false);
        if ("error" in result && result.error) { reportError(result.error.message); return; }
        setItems((previous) => reconcileTranscript(previous, result.data));
        onTranscript(reference.threadId, result.data);
      } catch {
        if (live) { setLoading(false); reportError("Unable to load this subagent."); }
      } finally {
        if (live) schedule();
      }
    };
    const schedule = () => {
      timer = window.setTimeout(() => {
        if (globalThis.document.visibilityState === "visible") void read();
        else schedule();
      }, thinking ? 2_500 : 30_000);
    };
    const refreshVisible = () => { if (globalThis.document.visibilityState === "visible") setRevision((current) => current + 1); };
    void read();
    globalThis.document.addEventListener("visibilitychange", refreshVisible);
    return () => { live = false; if (timer !== undefined) window.clearTimeout(timer); globalThis.document.removeEventListener("visibilitychange", refreshVisible); };
  }, [accountId, api, onTranscript, reference.threadId, reportError, revision, thinking]);

  useLayoutEffect(() => {
    if (loading || opened.current || !scrollRef.current) return;
    opened.current = true;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [items, loading]);

  useEffect(() => {
    const priorFocus = globalThis.document.activeElement as HTMLElement | null;
    window.setTimeout(() => closeRef.current?.focus(), 0);
    return () => priorFocus?.focus();
  }, []);


  const send = async () => {
    const text = draft.trim();
    if (!text || thinking) return;
    try {
      const result = await api.startTurn(accountId, reference.threadId, text, normalizeExecutionSettings(models, settings));
      if ("error" in result && result.error) return reportError(result.error.message);
      markTurnActive(accountId, reference.threadId, turnIdFromStart(result.data));
      setDraft("");
      setRevision((current) => current + 1);
      report("Message sent.");
    } catch { reportError("Unable to message this subagent."); }
  };

  const steer = async () => {
    const text = draft.trim();
    if (!latestTurnId || !text) return;
    try {
      const result = await api.steerTurn(accountId, reference.threadId, latestTurnId, text);
      if ("error" in result && result.error) return reportError(result.error.message);
      setDraft("");
      setRevision((current) => current + 1);
      report("Turn steered.");
    } catch { reportError("Unable to steer this subagent."); }
  };

  const interrupt = async () => {
    if (!latestTurnId) return;
    try {
      const result = await api.interruptTurn(accountId, reference.threadId, latestTurnId);
      if ("error" in result && result.error) return reportError(result.error.message);
      setRevision((current) => current + 1);
      report("Turn interrupted.");
    } catch { reportError("Unable to interrupt this subagent."); }
  };

  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="subagent-dialog" role="dialog" aria-modal="true" aria-label={`Subagent ${reference.label}`} onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}>
      <header className="subagent-dialog__header"><div><span>{accountId}</span><h2 id="subagent-dialog-title">Subagent {reference.label}</h2></div>{thinking ? <span className="chat-thinking"><span className="loading-spinner" aria-hidden="true" />Thinking</span> : null}<OverlayCloseButton ref={closeRef} onClick={onClose} /></header>
      <div className="transcript-scroll subagent-dialog__transcript" ref={scrollRef} aria-label={`Conversation with ${reference.label}`}>
        {loading ? <div className="transcript-working"><span className="loading-spinner" aria-hidden="true" /><span>Loading subagent…</span></div> : items.length ? <TranscriptTurns items={items} activeReasoningId={thinking ? [...items].reverse().find((item) => item.turnId === latestTurnId && item.type === "reasoning")?.id : undefined} onOpenMarkdown={onOpenMarkdown} /> : <div className="transcript-empty"><p>No messages in this subagent yet.</p></div>}
      </div>
      <form className="chat-compose subagent-dialog__composer" onSubmit={(event) => { event.preventDefault(); void send(); }}>
        <div className="chat-compose__field"><textarea aria-label="Message" rows={2} placeholder={thinking ? "Steer this turn…" : "Write a message…"} value={draft} onChange={(event) => setDraft(event.target.value)} /></div>
        <TurnOptions models={models} settings={settings} onChange={onSettingsChange} />
        <div className="chat-compose__footer"><div className="chat-compose__turn-actions"><button type="button" aria-label="Steer" title="Steer" disabled={!latestTurnId || !draft.trim()} onClick={() => void steer()}><CornerUpRight aria-hidden="true" size={16} strokeWidth={1.75} /></button><button type="button" aria-label="Interrupt" title="Interrupt" disabled={!latestTurnId || !thinking} onClick={() => void interrupt()}><CircleStop aria-hidden="true" size={16} strokeWidth={1.75} /></button></div><button className="primary-button chat-compose__send" type="submit" aria-label="Send" title="Send" disabled={thinking || !draft.trim()}><Send aria-hidden="true" size={16} strokeWidth={2} /></button></div>
      </form>
    </section>
  </div>;
}
