import { useState } from "react";
import { EdenTextArea } from "@/components/primitives/EdenTextArea";
import { EdenButton } from "@/components/primitives/EdenButton/EdenButton";
import type { CoordinatorApi } from "../../../api.js";
import { useQueueCommand } from "../data/queries.js";
import styles from "../styles.module.scss";

export function DescriptionEditor({ api, listId, taskId, initialDescription, onSaved }: { api: CoordinatorApi; listId: string; taskId?: string; initialDescription: string; onSaved: () => void }) {
  const mutation = useQueueCommand();
  const [description, setDescription] = useState(initialDescription);
  return <form className={styles.form} onSubmit={event => { event.preventDefault(); mutation.mutate(() => taskId ? api.editQueuedTask(taskId, description) : api.addQueuedTask(listId, description), { onSuccess: onSaved }); }}>
    <label htmlFor="todo-description">Description</label>
    <EdenTextArea id="todo-description" autoFocus required rows={6} autoResize maxAutoHeight={360} maxLength={32000} disabled={mutation.isPending} value={description} onChange={event => setDescription(event.target.value)} />
    {mutation.error && <div role="alert">{mutation.error.message}</div>}
    <EdenButton density="compact" appearance="primary" isFloating={false} type="submit" disabled={mutation.isPending || !description.trim()}>{mutation.isPending ? "Saving…" : taskId ? "Save" : "Add"}</EdenButton>
  </form>;
}
