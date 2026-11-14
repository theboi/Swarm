import { EdenField } from "@/components/primitives/EdenField";
import { EdenTextArea } from "@/components/primitives/EdenTextArea";
import { EdenButton } from "@/components/primitives/EdenButton/EdenButton";
import { EdenCard } from "@/components/primitives/EdenCard";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { EdenIcon } from "@/components/primitives/EdenIcon/EdenIcon";
import type { CoordinatorApi } from "../api.js";
import { isBotProfileAccountId, isMacosBotId, type AccountId } from "../../shared/contracts.js";
import type { QueuedTask } from "../../shared/queuedTasks.js";
import { useCoordinatorStore } from "../store/coordinatorStore.js";

type SendTarget = { taskId: string; accountId: string; threadId?: string; messageId: string };
export function QueuedTasksPage({ api, onOpenChat }: { api: CoordinatorApi; onOpenChat: (target: { accountId: AccountId; threadId: string }) => void }) {
  const { snapshot } = useCoordinatorStore();
  const bots = snapshot?.accounts.filter(account => isBotProfileAccountId(account.id) || isMacosBotId(account.id)) ?? [];
  const available = (id: string) => bots.some(bot => bot.id === id && bot.connection === "connected" && bot.authentication === "authenticated");
  const [tasks, setTasks] = useState<QueuedTask[]>([]);
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<QueuedTask | null>(null);
  const [sendTarget, setSendTarget] = useState<SendTarget | null>(null);
  const actionRunning = useRef(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    let live = true;
    void api.listQueuedTasks().then(result => {
      if (!live) return;
      if (result.error) setError(result.error.message); else setTasks(result.data);
    }).catch(() => { if (live) setError("Unable to load queued tasks."); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [api]);

  useEffect(() => {
    if (!busy && !editing && !sendTarget && trigger.current) {
      trigger.current.focus();
      trigger.current = null;
    }
  }, [busy, editing, sendTarget]);

  async function change(operation: () => ReturnType<CoordinatorApi["listQueuedTasks"]>, failure: string, success?: () => void) {
    if (actionRunning.current) return;
    actionRunning.current = true; setBusy(true); setError(null);
    try {
      const result = await operation();
      if (result.error) setError(result.error.message);
      else { setTasks(result.data); success?.(); }
    } catch { setError(failure); }
    finally { actionRunning.current = false; setBusy(false); }
  }
  function closeAction() {
    setEditing(null); setSendTarget(null); setError(null);
  }
  async function send(task: QueuedTask) {
    if (!sendTarget || !available(sendTarget.accountId) || actionRunning.current) return;
    actionRunning.current = true; setBusy(true); setError(null);
    const target = { ...sendTarget };
    try {
      if (!target.threadId) {
        const created = await api.startThread(target.accountId);
        if (created.error) { setError(created.error.message); return; }
        target.threadId = created.data.id;
        setSendTarget(target);
      }
      const renamed = await api.renameThread(target.accountId, target.threadId, task.title);
      if (renamed.error) { setError(renamed.error.message); return; }
      const result = await api.startTurn(target.accountId, target.threadId, task.prompt, undefined, target.messageId);
      if (result.error) { setError(result.error.message); return; }
      setSendTarget(null);
      onOpenChat({ accountId: target.accountId as AccountId, threadId: target.threadId });
    } catch { setError("Unable to send the prompt. Retry to use the same chat."); }
    finally { actionRunning.current = false; setBusy(false); }
  }
  return <section className="page queued-tasks-page" aria-label="Queued tasks">
    <h1>Queued tasks</h1>
    <form className="queued-task-form" onSubmit={(event: FormEvent) => {
      event.preventDefault();
      void change(() => api.addQueuedTask(title, prompt), "Unable to save task. Try again.", () => { setTitle(""); setPrompt(""); });
    }}>
      <label htmlFor="todo-title">Title</label><EdenField id="todo-title" required maxLength={200} disabled={busy} value={title} onChange={event => setTitle(event.target.value)} />
      <label htmlFor="todo-prompt">Prompt</label><EdenTextArea id="todo-prompt" required maxLength={32000} rows={5} disabled={busy} value={prompt} onChange={event => setPrompt(event.target.value)} />
      <EdenButton density="compact" appearance="primary" isFloating={false} type="submit" className="" disabled={loading || busy || !title.trim() || !prompt.trim()}>Add todo</EdenButton>
    </form>
    {error ? <p role="alert">{error}</p> : null}
    {loading ? <p role="status">Loading queued tasks…</p> : tasks.length ? <ul className="queued-task-list">{tasks.map(task => <EdenCard asChild key={task.id}><li>
      <div className="queued-task-header">
        <label className="queued-task-title"><input type="checkbox" checked={task.completed} disabled={busy} onChange={() => void change(() => api.completeQueuedTask(task.id, !task.completed), "Unable to update task. Try again.")} aria-label={`Complete ${task.title}`} /><strong>{task.completed ? <s>{task.title}</s> : task.title}</strong></label>
        <div className="queued-task-actions">
          <EdenButton density="compact" appearance="secondary" isFloating={false} type="button" className="icon-button" title="Delete" aria-label={`Delete ${task.title}`} disabled={busy} onClick={() => void change(() => api.deleteQueuedTask(task.id), "Unable to delete task. Try again.", () => { if (editing?.id === task.id) setEditing(null); if (sendTarget?.taskId === task.id) setSendTarget(null); })}><EdenIcon name="trash2" aria-hidden="true" size={18} /></EdenButton>
          <EdenButton density="compact" appearance="secondary" isFloating={false} type="button" className="icon-button" title="Edit" aria-label={`Edit ${task.title}`} disabled={busy} onClick={event => { trigger.current = event.currentTarget; setEditing({ ...task }); setSendTarget(null); setError(null); }}><EdenIcon name="pencil" aria-hidden="true" size={18} /></EdenButton>
          <EdenButton density="compact" appearance="secondary" isFloating={false} type="button" className="icon-button" title="Send to bot" aria-label={`Send ${task.title} to bot`} disabled={busy} onClick={event => { trigger.current = event.currentTarget; setEditing(null); setSendTarget({ taskId: task.id, accountId: bots.find(bot => available(bot.id))?.id ?? "", messageId: crypto.randomUUID() }); setError(null); }}><EdenIcon name="bot" aria-hidden="true" size={18} /></EdenButton>
        </div>
      </div>
      {editing?.id === task.id ? <form className="queued-task-form" onKeyDown={event => { if (event.key === "Escape" && !busy) closeAction(); }} onSubmit={event => {
        event.preventDefault(); void change(() => api.editQueuedTask(task.id, editing.title, editing.prompt), "Unable to save changes. Try again.", closeAction);
      }}>
        <label htmlFor={`edit-title-${task.id}`}>Edit title</label><EdenField id={`edit-title-${task.id}`} autoFocus required maxLength={200} disabled={busy} value={editing.title} onChange={event => setEditing({ ...editing, title: event.target.value })} />
        <label htmlFor={`edit-prompt-${task.id}`}>Edit prompt</label><EdenTextArea id={`edit-prompt-${task.id}`} required maxLength={32000} rows={5} disabled={busy} value={editing.prompt} onChange={event => setEditing({ ...editing, prompt: event.target.value })} />
        <div className="queued-task-actions"><EdenButton density="compact" appearance="primary" isFloating={false} type="submit" className="" disabled={busy || !editing.title.trim() || !editing.prompt.trim()}>Save changes</EdenButton><EdenButton density="compact" appearance="secondary" isFloating={false} type="button" disabled={busy} onClick={closeAction}>Cancel</EdenButton></div>
      </form> : <p>{task.prompt}</p>}
      {sendTarget?.taskId === task.id ? <form className="queued-task-send" onKeyDown={event => { if (event.key === "Escape" && !busy) closeAction(); }} onSubmit={event => { event.preventDefault(); void send(task); }}>
        <EdenDropdown label="Bot" density="compact" portalled clearable={false} placeholder="Select a bot" values={[sendTarget.accountId]} disabled={busy || Boolean(sendTarget.threadId)}
          options={[{ items: bots.map(bot => ({ value: bot.id, label: `${bot.id}${available(bot.id) ? "" : " — unavailable"}`, disabled: !available(bot.id) })) }]}
          onChange={([accountId]) => { if (accountId) setSendTarget({ ...sendTarget, accountId }); }} />
        {!bots.some(bot => available(bot.id)) ? <p>Connect a bot in Accounts to send this todo.</p> : null}
        <div className="queued-task-actions"><EdenButton density="compact" appearance="primary" isFloating={false} type="submit" className="" disabled={busy || !available(sendTarget.accountId)}>{busy ? "Sending…" : "Send prompt"}</EdenButton><EdenButton density="compact" appearance="secondary" isFloating={false} type="button" disabled={busy} onClick={closeAction}>Cancel</EdenButton></div>
      </form> : null}
    </li></EdenCard>)}</ul> : <p>No queued tasks yet.</p>}
  </section>;
}
import { EdenDropdown } from "@/components/primitives/EdenDropdown";
