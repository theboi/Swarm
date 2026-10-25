import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, Pencil, Trash2 } from "lucide-react";
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
      <label htmlFor="todo-title">Title</label><input id="todo-title" required maxLength={200} disabled={busy} value={title} onChange={event => setTitle(event.target.value)} />
      <label htmlFor="todo-prompt">Prompt</label><textarea id="todo-prompt" required maxLength={32000} rows={5} disabled={busy} value={prompt} onChange={event => setPrompt(event.target.value)} />
      <button className="primary-button" disabled={loading || busy || !title.trim() || !prompt.trim()}>Add todo</button>
    </form>
    {error ? <p role="alert">{error}</p> : null}
    {loading ? <p role="status">Loading queued tasks…</p> : tasks.length ? <ul className="queued-task-list">{tasks.map(task => <li key={task.id}>
      <div className="queued-task-header">
        <label className="queued-task-title"><input type="checkbox" checked={task.completed} disabled={busy} onChange={() => void change(() => api.completeQueuedTask(task.id, !task.completed), "Unable to update task. Try again.")} aria-label={`Complete ${task.title}`} /><strong>{task.completed ? <s>{task.title}</s> : task.title}</strong></label>
        <div className="queued-task-actions">
          <button type="button" className="icon-button" title="Delete" aria-label={`Delete ${task.title}`} disabled={busy} onClick={() => void change(() => api.deleteQueuedTask(task.id), "Unable to delete task. Try again.", () => { if (editing?.id === task.id) setEditing(null); if (sendTarget?.taskId === task.id) setSendTarget(null); })}><Trash2 aria-hidden="true" size={18} /></button>
          <button type="button" className="icon-button" title="Edit" aria-label={`Edit ${task.title}`} disabled={busy} onClick={event => { trigger.current = event.currentTarget; setEditing({ ...task }); setSendTarget(null); setError(null); }}><Pencil aria-hidden="true" size={18} /></button>
          <button type="button" className="icon-button" title="Send to bot" aria-label={`Send ${task.title} to bot`} disabled={busy} onClick={event => { trigger.current = event.currentTarget; setEditing(null); setSendTarget({ taskId: task.id, accountId: bots.find(bot => available(bot.id))?.id ?? "", messageId: crypto.randomUUID() }); setError(null); }}><Bot aria-hidden="true" size={18} /></button>
        </div>
      </div>
      {editing?.id === task.id ? <form className="queued-task-form" onKeyDown={event => { if (event.key === "Escape" && !busy) closeAction(); }} onSubmit={event => {
        event.preventDefault(); void change(() => api.editQueuedTask(task.id, editing.title, editing.prompt), "Unable to save changes. Try again.", closeAction);
      }}>
        <label htmlFor={`edit-title-${task.id}`}>Edit title</label><input id={`edit-title-${task.id}`} autoFocus required maxLength={200} disabled={busy} value={editing.title} onChange={event => setEditing({ ...editing, title: event.target.value })} />
        <label htmlFor={`edit-prompt-${task.id}`}>Edit prompt</label><textarea id={`edit-prompt-${task.id}`} required maxLength={32000} rows={5} disabled={busy} value={editing.prompt} onChange={event => setEditing({ ...editing, prompt: event.target.value })} />
        <div className="queued-task-actions"><button className="primary-button" disabled={busy || !editing.title.trim() || !editing.prompt.trim()}>Save changes</button><button type="button" disabled={busy} onClick={closeAction}>Cancel</button></div>
      </form> : <p>{task.prompt}</p>}
      {sendTarget?.taskId === task.id ? <form className="queued-task-send" onKeyDown={event => { if (event.key === "Escape" && !busy) closeAction(); }} onSubmit={event => { event.preventDefault(); void send(task); }}>
        <label htmlFor={`send-bot-${task.id}`}>Bot</label>
        <select id={`send-bot-${task.id}`} autoFocus value={sendTarget.accountId} disabled={busy || Boolean(sendTarget.threadId)} onChange={event => setSendTarget({ ...sendTarget, accountId: event.target.value })}>
          <option value="" disabled>Select a bot</option>{bots.map(bot => <option key={bot.id} value={bot.id} disabled={!available(bot.id)}>{bot.id}{available(bot.id) ? "" : " — unavailable"}</option>)}
        </select>
        {!bots.some(bot => available(bot.id)) ? <p>Connect a bot in Accounts to send this todo.</p> : null}
        <div className="queued-task-actions"><button className="primary-button" disabled={busy || !available(sendTarget.accountId)}>{busy ? "Sending…" : "Send prompt"}</button><button type="button" disabled={busy} onClick={closeAction}>Cancel</button></div>
      </form> : null}
    </li>)}</ul> : <p>No queued tasks yet.</p>}
  </section>;
}
