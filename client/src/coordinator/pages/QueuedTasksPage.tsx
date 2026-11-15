import { useEffect, useState, useTransition } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EdenButton } from "@/components/primitives/EdenButton/EdenButton";
import { EdenIcon } from "@/components/primitives/EdenIcon/EdenIcon";
import type { CoordinatorApi } from "../api.js";
import type { AccountId } from "../../shared/contracts.js";
import { ListsPanel } from "./QueuedTasksPage/ListsPanel/index.js";
import { TodoList } from "./QueuedTasksPage/TodoList/index.js";
import { QueryBoundary } from "./QueuedTasksPage/QueryBoundary/index.js";
import styles from "./QueuedTasksPage/styles.module.scss";

type Props = { api: CoordinatorApi; onOpenChat: (target: { accountId: AccountId; threadId: string }) => void };
export function QueuedTasksPage(props: Props) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } }));
  return <QueryClientProvider client={client}><_QueuedTasksPage {...props} /></QueryClientProvider>;
}
function _QueuedTasksPage({ api, onOpenChat }: Props) {
  const [selectedId, setSelectedId] = useState(() => new URLSearchParams(window.location.search).get("list"));
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const update = () => startTransition(() => setSelectedId(new URLSearchParams(window.location.search).get("list")));
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  function select(id: string | null) {
    window.history.pushState(null, "", id ? `/todos?${new URLSearchParams({ list: id })}` : "/todos");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
  return <section className={styles.page} aria-label="Todos" data-selected={Boolean(selectedId)} aria-busy={pending}>
    <aside className={styles.lists} aria-label="Task lists"><QueryBoundary><ListsPanel api={api} selectedId={selectedId} onSelect={select} /></QueryBoundary></aside>
    <div className={styles.detail}>
      {selectedId && <EdenButton className={styles.back} density="compact" appearance="borderless" isFloating={false} onClick={() => select(null)}><EdenIcon name="arrowLeft" size={16} />Lists</EdenButton>}
      <QueryBoundary key={selectedId}>{selectedId ? <TodoList key={selectedId} api={api} listId={selectedId} onOpenChat={onOpenChat} /> : null}</QueryBoundary>
    </div>
  </section>;
}
