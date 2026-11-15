import { EdenBadge } from "@/components/primitives/EdenBadge";
import { EdenButton } from "@/components/primitives/EdenButton/EdenButton";
import { EdenDropdown } from "@/components/primitives/EdenDropdown";
import { EdenListCardItem } from "@/components/primitives/EdenListCard/EdenListCardItem";
import { EdenIcon } from "@/components/primitives/EdenIcon/EdenIcon";
import { QUEUED_TASK_STATUSES, type QueuedTask, type QueuedTaskStatus } from "../../../../shared/queuedTasks.js";
import type { CoordinatorApi } from "../../../api.js";
import { useQueueCommand } from "../data/queries.js";
import styles from "./styles.module.scss";

const STATES = {
  todo: { label: "Todo", tone: "muted" },
  priority: { label: "Todo (priority)", tone: "warning" },
  "in-progress": { label: "In Progress", tone: "accent" },
  complete: { label: "Complete", tone: "success" },
} as const;
export function TodoRow({ task, api, onAction }: { task: QueuedTask; api: CoordinatorApi; onAction: (kind: "edit" | "send" | "move", id: string) => void }) {
  const mutation = useQueueCommand();
  const busy = mutation.isPending;
  function change(status: QueuedTaskStatus) { mutation.mutate(() => api.changeQueuedTask(task.id, { status })); }
  return <li className={styles.row} aria-label={`Todo: ${task.description.slice(0, 120)}`} aria-busy={busy}>
    <div className={styles.content}>
      <EdenListCardItem aria-label="Edit description" selected={false} disabled={busy} onClick={() => onAction("edit", task.id)}
        title={<span className={styles.descriptionText}>{task.description}</span>}
        metadata={<time className={styles.date} dateTime={task.createdAt} title={`Created ${new Date(task.createdAt).toLocaleString()}`}>{new Date(task.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</time>} />
    </div>
    <div className={styles.actions}>
      <EdenDropdown label="Todo state" hideLabel hideHeader portalled clearable={false} disabled={busy} density="compact"
        trigger={<EdenButton density="compact" appearance="borderless" isFloating={false} aria-label={`Todo state: ${STATES[task.status].label}`}><EdenBadge tone={STATES[task.status].tone}>{STATES[task.status].label}</EdenBadge><EdenIcon name="chevronDown" size={14} /></EdenButton>}
        options={[{ selection: "none", items: QUEUED_TASK_STATUSES.map(status => ({ value: status, current: status === task.status, label: <EdenBadge tone={STATES[status].tone}>{STATES[status].label}</EdenBadge>, onSelect: () => change(status) })) }]} />
      <EdenDropdown label="Todo actions" hideLabel hideHeader align="end" portalled disabled={busy} density="compact"
        trigger={<EdenButton density="compact" appearance="borderless" isFloating={false} aria-label="Todo actions"><EdenIcon name="moreHorizontal" size={18} /></EdenButton>}
        options={[{ selection: "none", items: [
          { value: "send", label: "Send to...", onSelect: () => onAction("send", task.id) },
          { value: "move", label: "Move to List...", onSelect: () => onAction("move", task.id) },
          { value: "delete", label: "Delete", danger: true, onSelect: () => mutation.mutate(() => api.deleteQueuedTask(task.id)) },
        ] }]} />
    </div>
    {mutation.error && <div role="alert" className={styles.error}>{mutation.error.message}</div>}
  </li>;
}
