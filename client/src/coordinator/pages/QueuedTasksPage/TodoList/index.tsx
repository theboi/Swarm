import { useState } from "react";
import { EdenButton } from "@/components/primitives/EdenButton/EdenButton";
import { EdenIcon } from "@/components/primitives/EdenIcon/EdenIcon";
import { useEdenModal } from "@/components/overlay/EdenOverlayProvider/useEdenModal";
import type { AccountId } from "../../../../shared/contracts.js";
import type { CoordinatorApi } from "../../../api.js";
import { useTaskLists, useListTodos } from "../data/queries.js";
import { TodoRow } from "../TodoRow/index.js";
import { DescriptionEditor } from "../DescriptionEditor/index.js";
import { MoveTodo } from "../MoveTodo/index.js";
import { SendTodo } from "../SendTodo/index.js";
import { QueryBoundary } from "../QueryBoundary/index.js";
import styles from "../styles.module.scss";

export function TodoList({ api, listId, onOpenChat }: { api: CoordinatorApi; listId: string; onOpenChat: (target: { accountId: AccountId; threadId: string }) => void }) {
  const listsQuery = useTaskLists(api);
  const query = useListTodos(api, listId);
  const [action, setAction] = useState<{ kind: "add" | "edit" | "move" | "send"; id?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const task = query.data.find(task => task.id === action?.id);
  const close = () => setAction(null);
  const { modal } = useEdenModal({
    title: action?.kind === "send" ? "Send to..." : action?.kind === "move" ? "Move to List..." : action?.kind === "edit" ? "Edit todo" : "Add todo",
    size: action?.kind === "send" || action?.kind === "move" ? "compact" : "default",
    open: Boolean(action), onClose: () => { if (!busy) close(); }, dismissible: !busy,
    content: <QueryBoundary>
      {action?.kind === "add" || (action?.kind === "edit" && task) ? <DescriptionEditor key={action.id ?? "new"} api={api} listId={listId} taskId={task?.id} initialDescription={task?.description ?? ""} onSaved={close} /> : null}
      {action?.kind === "move" && action.id ? <MoveTodo api={api} listId={listId} taskId={action.id} onMoved={close} /> : null}
      {action?.kind === "send" && task ? <SendTodo api={api} description={task.description} onBusyChange={setBusy} onSent={target => { close(); onOpenChat(target); }} /> : null}
    </QueryBoundary>,
  });
  return <>
    <header className={styles.header}>
      <h2>{listsQuery.data.find(list => list.id === listId)?.name}</h2>
    </header>
    <ul className={styles.todos} aria-label="Todos">{query.data.map(task => <TodoRow key={task.id} task={task} api={api} onAction={(kind, id) => setAction({ kind, id })} />)}</ul>
    <EdenButton className={styles.add} density="compact" appearance="secondary" isFloating={false} aria-label="Add todo" onClick={() => setAction({ kind: "add" })}><EdenIcon name="plus" size={20} /></EdenButton>
    {modal}
  </>;
}
