import { useState } from "react";
import { EdenDropdown } from "@/components/primitives/EdenDropdown";
import { EdenButton } from "@/components/primitives/EdenButton/EdenButton";
import type { CoordinatorApi } from "../../../api.js";
import { useTaskLists, useQueueCommand } from "../data/queries.js";
import styles from "../styles.module.scss";

export function MoveTodo({ api, taskId, listId, onMoved }: { api: CoordinatorApi; taskId: string; listId: string; onMoved: () => void }) {
  const query = useTaskLists(api);
  const mutation = useQueueCommand();
  const [targetId, setTargetId] = useState("");
  return <form className={styles.form} onSubmit={event => { event.preventDefault(); mutation.mutate(() => api.changeQueuedTask(taskId, { listId: targetId }), { onSuccess: onMoved }); }}>
    <EdenDropdown label="List" portalled clearable={false} values={targetId ? [targetId] : []} disabled={mutation.isPending} options={[{ items: query.data.filter(list => list.id !== listId).map(list => ({ value: list.id, label: list.name })) }]} onChange={([id]) => setTargetId(id ?? "")} />
    {mutation.error && <div role="alert">{mutation.error.message}</div>}
    <EdenButton type="submit" density="compact" appearance="primary" isFloating={false} disabled={mutation.isPending || !targetId}>{mutation.isPending ? "Moving…" : "Move"}</EdenButton>
  </form>;
}
