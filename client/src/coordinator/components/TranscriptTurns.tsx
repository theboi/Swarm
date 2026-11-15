import { EdenButton } from "@/components/primitives/EdenButton/EdenButton";
import { memo, useMemo, useState } from "react";
import { EdenIcon } from "@/components/primitives/EdenIcon/EdenIcon";
import type { TranscriptItem } from "../../shared/contracts.js";
import { TranscriptItemView } from "./TranscriptItemView.js";

const RENDER_BATCH = 100;
type Turn = { key: string; items: TranscriptItem[]; finalId?: string; visibleIds: ReadonlySet<string> };

/** Keep server JSON round trips from invalidating every unchanged message. */
export function reconcileTranscript(previous: TranscriptItem[], incoming: TranscriptItem[]): TranscriptItem[] {
  const key = (item: TranscriptItem) => `${item.accountId}\u0000${item.threadId}\u0000${item.turnId ?? ""}\u0000${item.id}`;
  const existing = new Map(previous.map((item) => [key(item), item]));
  const next = incoming.map((item) => {
    const old = existing.get(key(item));
    return old && JSON.stringify(old) === JSON.stringify(item) ? old : item;
  });
  return previous.length === next.length && next.every((item, index) => item === previous[index]) ? previous : next;
}

function groupTurns(items: TranscriptItem[]): Turn[] {
  const turns: Turn[] = [];
  for (const item of items) {
    const key = `${item.accountId}\u0000${item.threadId}\u0000${item.turnId ?? item.id}`;
    let turn = turns.at(-1);
    if (!turn || turn.key !== key || item.turnId === null) {
      turn = { key, items: [], visibleIds: new Set() };
      turns.push(turn);
    }
    turn.items.push(item);
  }
  for (const turn of turns) {
    if (!turn.items[0].turnId) continue;
    const terminalStatus = turn.items.find((item) => item.turnStatus)?.turnStatus;
    if (terminalStatus && terminalStatus !== "completed") continue;
    const final = [...turn.items].reverse().find((item) => item.type === "agentMessage" && (
      (item.payload.phase === "final_answer" && item.status === "completed") ||
      (terminalStatus === "completed" && item.payload.phase !== "commentary")
    ));
    if (!final) continue;
    turn.finalId = final.id;
    // Keep the whole conversation visible, including opening prompts, steers,
    // and earlier assistant questions. Only commentary and activity are details.
    turn.visibleIds = new Set(turn.items.filter((item) => item.type === "userMessage" || (item.type === "agentMessage" && item.payload.phase !== "commentary")).map((item) => item.id));
  }
  return turns;
}

function TranscriptTurn({ turn, activeReasoningId, onOpenMarkdown }: { turn: Turn; activeReasoningId?: string; onOpenMarkdown: (path: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = turn.finalId ? turn.items.filter((item) => item.id !== turn.finalId && !turn.visibleIds.has(item.id)).length : 0;
  const collapsed = Boolean(turn.finalId && !expanded);
  return <div className="transcript-turn">
    {hiddenCount ? <EdenButton density="superCompact" appearance="borderless" isFloating={false} className="transcript-load-earlier transcript-turn__toggle" type="button" aria-expanded={!collapsed} onClick={() => setExpanded((value) => !value)}>
      {collapsed ? <EdenIcon name="chevronDown" aria-hidden="true" size={16} /> : <EdenIcon name="chevronUp" aria-hidden="true" size={16} />}
      {collapsed ? "Show turn details" : "Hide turn details"} <span>({hiddenCount})</span>
    </EdenButton> : null}
    {turn.items.filter((item) => !collapsed || item.id === turn.finalId || turn.visibleIds.has(item.id)).map((item) => <TranscriptItemView key={item.id} item={item} active={item.id === activeReasoningId} onOpenMarkdown={onOpenMarkdown} />)}
  </div>;
}

/** Owns history windowing and disclosure state, independent of composer typing. */
export const TranscriptTurns = memo(function TranscriptTurns({ items, activeReasoningId, onOpenMarkdown }: { items: TranscriptItem[]; activeReasoningId?: string; onOpenMarkdown: (path: string) => void }) {
  const [visibleCount, setVisibleCount] = useState(RENDER_BATCH);
  const turns = useMemo(() => groupTurns(items), [items]);
  const cutoff = Math.max(0, items.length - visibleCount);
  let offset = 0;
  let hiddenCount = 0;
  const visibleTurns: Turn[] = [];
  for (const turn of turns) {
    const end = offset + turn.items.length;
    if (end <= cutoff) hiddenCount += turn.items.length;
    else if (offset < cutoff && !turn.finalId) {
      // Active turns can be huge too. Group metadata still uses the full history.
      hiddenCount += cutoff - offset;
      visibleTurns.push({ ...turn, items: turn.items.slice(cutoff - offset) });
    } else visibleTurns.push(turn);
    offset = end;
  }
  return <>
    {hiddenCount > 0 ? <EdenButton density="superCompact" appearance="borderless" isFloating={false} className="transcript-load-earlier" type="button" onClick={() => setVisibleCount((value) => value + RENDER_BATCH)}>Show earlier messages</EdenButton> : null}
    {visibleTurns.map((turn) => <TranscriptTurn key={turn.key} turn={turn} activeReasoningId={activeReasoningId} onOpenMarkdown={onOpenMarkdown} />)}
  </>;
});
