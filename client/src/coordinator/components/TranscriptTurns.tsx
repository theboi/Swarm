import { EdenButton } from "@/components/primitives/EdenButton/EdenButton";
import { memo, useMemo, useState } from "react";
import { EdenIcon } from "@/components/primitives/EdenIcon/EdenIcon";
import type { TranscriptItem } from "../../shared/contracts.js";
import { TranscriptBlock } from "./TranscriptTurns/TranscriptBlock/index.js";
import { TranscriptViewPreferences } from "./TranscriptTurns/viewPreferences.js";

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

const TranscriptTurn = memo(function TranscriptTurn({ turn, initiallyVisible, activeReasoningId, onOpenMarkdown }: { turn: Turn; initiallyVisible: boolean; activeReasoningId?: string; onOpenMarkdown: (path: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const hiddenCount = turn.finalId ? turn.items.filter((item) => item.id !== turn.finalId && !turn.visibleIds.has(item.id)).length : 0;
  const collapsed = Boolean(turn.finalId && !expanded);
  const blocks = useMemo(() => {
    const visible = turn.items.filter(item => !collapsed || item.id === turn.finalId || turn.visibleIds.has(item.id));
    const blocks: TranscriptItem[][] = [];
    for (let offset = 0; offset < visible.length; offset += 25) blocks.push(visible.slice(offset, offset + 25));
    return blocks;
  }, [turn, collapsed]);
  return <div className="transcript-turn">
    {hiddenCount ? <EdenButton density="superCompact" appearance="borderless" isFloating={false} className="transcript-load-earlier transcript-turn__toggle" type="button" aria-expanded={!collapsed} onClick={() => setExpanded((value) => !value)}>
      {collapsed ? <EdenIcon name="chevronDown" aria-hidden="true" size={16} /> : <EdenIcon name="chevronUp" aria-hidden="true" size={16} />}
      {collapsed ? "Show turn details" : "Hide turn details"} <span>({hiddenCount})</span>
    </EdenButton> : null}
    {blocks.map((items, index) => <TranscriptBlock key={items[0].id} items={items} initiallyVisible={initiallyVisible && index >= blocks.length - 4} activeReasoningId={activeReasoningId} onOpenMarkdown={onOpenMarkdown} />)}
  </div>;
}, (previous, next) => previous.initiallyVisible === next.initiallyVisible && previous.onOpenMarkdown === next.onOpenMarkdown && previous.activeReasoningId === next.activeReasoningId && previous.turn.items.length === next.turn.items.length && previous.turn.items.every((item, index) => item === next.turn.items[index]));

/** Owns history windowing and disclosure state, independent of composer typing. */
export const TranscriptTurns = memo(function TranscriptTurns({ items, activeReasoningId, onOpenMarkdown }: { items: TranscriptItem[]; activeReasoningId?: string; onOpenMarkdown: (path: string) => void }) {
  const [preferences] = useState(() => new Map<string, { expanded: boolean; renderMarkdown: boolean }>());
  const turns = useMemo(() => groupTurns(items), [items]);
  const cutoff = Math.max(0, items.length - RENDER_BATCH);
  let offset = 0;
  return <TranscriptViewPreferences value={preferences}>{turns.map(turn => {
    offset += turn.items.length;
    return <TranscriptTurn key={turn.key} turn={turn} initiallyVisible={offset > cutoff} activeReasoningId={activeReasoningId} onOpenMarkdown={onOpenMarkdown} />;
  })}</TranscriptViewPreferences>;
});
