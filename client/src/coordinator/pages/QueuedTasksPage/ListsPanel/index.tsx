import { useEffect, useState } from "react";
import { EdenListCard } from "@/components/primitives/EdenListCard";
import { EdenListCardItem } from "@/components/primitives/EdenListCard/EdenListCardItem";
import { EdenField } from "@/components/primitives/EdenField";
import { EdenButton } from "@/components/primitives/EdenButton/EdenButton";
import { EdenIcon } from "@/components/primitives/EdenIcon/EdenIcon";
import { useEdenModal } from "@/components/overlay/EdenOverlayProvider/useEdenModal";
import type { CoordinatorApi } from "../../../api.js";
import type { QueuedTaskList } from "../../../../shared/queuedTasks.js";
import { useTaskLists, useQueueCommand } from "../data/queries.js";
import styles from "../styles.module.scss";

export function ListsPanel({ api, selectedId, onSelect, onDefaultSelect }: { api: CoordinatorApi; selectedId: string | null; onSelect: (id: string) => void; onDefaultSelect?: (id: string) => void }) {
  const query = useTaskLists(api);
  useEffect(() => {
    if (!selectedId && query.data[0]) onDefaultSelect?.(query.data[0].id);
  }, [selectedId, query.data, onDefaultSelect]);
  const mutation = useQueueCommand<QueuedTaskList>();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const { modal } = useEdenModal({ title: "Create List", size: "compact", open, onClose: () => setOpen(false), dismissible: !mutation.isPending,
    content: <form className={styles.form} onSubmit={event => {
      event.preventDefault();
      mutation.mutate(() => api.createQueuedTaskList(name), { onSuccess: list => { setOpen(false); onSelect(list.id); } });
    }}>
      <label htmlFor="list-name">List name</label>
      <EdenField id="list-name" autoFocus required maxLength={200} value={name} disabled={mutation.isPending} onChange={event => setName(event.target.value)} />
      {mutation.error && <div role="alert">{mutation.error.message}</div>}
      <EdenButton type="submit" density="compact" appearance="primary" isFloating={false} disabled={mutation.isPending || !name.trim()}>{mutation.isPending ? "Creating…" : "Create"}</EdenButton>
    </form>,
  });
  return <>
    <EdenButton className={styles.create} density="compact" appearance="primary" isFloating={false} onClick={() => { setName(""); mutation.reset(); setOpen(true); }}><EdenIcon name="plus" size={16} />Create List</EdenButton>
    <EdenListCard sections={{ lists: { title: "Lists", items: query.data } }} getItemKey={list => list.id} renderItem={list => <EdenListCardItem title={list.name} selected={list.id === selectedId} onClick={() => onSelect(list.id)} trailing={<EdenIcon name="chevronRight" size={16} />} />} />
    {modal}
  </>;
}
