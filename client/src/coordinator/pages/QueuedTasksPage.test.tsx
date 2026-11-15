import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { QueuedTasksPage } from "./QueuedTasksPage.js";
import type { CoordinatorApi } from "../api.js";
import type { QueuedTask, QueuedTaskList } from "../../shared/queuedTasks.js";
import { renderWithOverlays } from "../test/renderWithOverlays.js";

vi.mock("../store/coordinatorStore.js", () => ({ useCoordinatorStore: () => ({ snapshot: { accounts: [
  { id: "bot3/acc1", connection: "connected", authentication: "authenticated" },
  { id: "bot6/acc1", connection: "disconnected", authentication: "unknown" },
  { id: "claudiothe", connection: "connected", authentication: "authenticated" },
] } }) }));
afterEach(() => { cleanup(); window.history.replaceState(null, "", "/queued-tasks"); });
const task: QueuedTask = { id: "todo-1", listId: "work", description: "  Find and fix\n the login error.\n", createdAt: "2026-11-15T10:00:00Z", status: "todo" };
function fixture() {
  let tasks = [{ ...task }];
  let lists: QueuedTaskList[] = [{ id: "work", name: "Work", createdAt: task.createdAt }, { id: "personal", name: "Personal", createdAt: task.createdAt }];
  const api = {
    listQueuedTaskLists: vi.fn(async () => ({ data: lists })),
    createQueuedTaskList: vi.fn(async (name: string) => { const list = { id: "new", name, createdAt: task.createdAt }; lists = [...lists, list]; return { data: list }; }),
    listQueuedTasks: vi.fn(async (listId: string) => ({ data: tasks.filter(task => task.listId === listId) })),
    addQueuedTask: vi.fn(async (listId: string, description: string) => { const value = { ...task, id: "todo-2", listId, description }; tasks = [...tasks, value]; return { data: value }; }),
    editQueuedTask: vi.fn(async (id: string, description: string) => { tasks = tasks.map(task => task.id === id ? { ...task, description } : task); return { data: tasks.find(task => task.id === id)! }; }),
    changeQueuedTask: vi.fn(async (id: string, input: Partial<QueuedTask>) => { tasks = tasks.map(task => task.id === id ? { ...task, ...input } : task); return { data: tasks.find(task => task.id === id)! }; }),
    deleteQueuedTask: vi.fn(async (id: string) => { tasks = tasks.filter(task => task.id !== id); return { data: { id } }; }),
    startThread: vi.fn(async () => ({ data: { id: "new-chat", accountId: "bot3/acc1" } })),
    startTurn: vi.fn(async (...args: unknown[]) => { void args; return { data: { queued: true } }; }),
  };
  const onOpenChat = vi.fn();
  renderWithOverlays(<QueuedTasksPage api={api as unknown as CoordinatorApi} onOpenChat={onOpenChat} />);
  return { api, onOpenChat };
}
async function selectWork(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Work" }));
  await screen.findByRole("button", { name: "Edit description" });
}
it("selects lists, edits exact descriptions and changes state through badge choices", async () => {
  const user = userEvent.setup(); const { api } = fixture();
  await selectWork(user);
  expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Edit description" }));
  await user.clear(screen.getByLabelText("Description"));
  await user.type(screen.getByLabelText("Description"), " Edited description ");
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByText("Edited description")).toBeVisible();
  expect(api.editQueuedTask).toHaveBeenCalledWith(task.id, " Edited description ");
  await user.click(screen.getByRole("button", { name: "Todo state: Todo" }));
  expect(screen.getByRole("radio", { name: "Todo" })).toHaveAttribute("aria-checked", "true");
  const priority = screen.getByRole("radio", { name: "Todo (priority)" });
  expect(priority).toHaveTextContent("Todo (priority)");
  await user.keyboard("{ArrowDown}{Enter}");
  await waitFor(() => expect(api.changeQueuedTask).toHaveBeenCalledWith(task.id, { status: "priority" }));
  expect(await screen.findByRole("button", { name: "Todo state: Todo (priority)" })).toBeVisible();
  expect(screen.queryByRole("dialog", { name: "Todo state" })).not.toBeInTheDocument();
});
it("moves todos between lists and deletes through the action menu", async () => {
  const user = userEvent.setup(); fixture(); await selectWork(user);
  await user.click(screen.getByRole("button", { name: "Todo actions" }));
  await user.click(screen.getByRole("button", { name: "Move to List..." }));
  await user.click(screen.getByRole("button", { name: /^List:/ }));
  await user.click(screen.getByRole("radio", { name: "Personal" }));
  await user.click(screen.getByRole("button", { name: "Move" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: "Edit description" })).not.toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: "Personal" }));
  await user.click(await screen.findByRole("button", { name: "Todo actions" }));
  await user.click(screen.getByRole("button", { name: "Delete" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: "Edit description" })).not.toBeInTheDocument());
});
it("creates a list and adds a description-only todo", async () => {
  const user = userEvent.setup(); const { api } = fixture();
  await user.click(await screen.findByRole("button", { name: "Create List" }));
  await user.type(screen.getByLabelText("List name"), "New list");
  await user.click(screen.getByRole("button", { name: "Create" }));
  await user.click(await screen.findByRole("button", { name: "Add todo" }));
  await user.type(screen.getByLabelText("Description"), " Exact new description ");
  await user.click(screen.getByRole("button", { name: "Add" }));
  expect(await screen.findByText("Exact new description")).toBeVisible();
  expect(api.addQueuedTask).toHaveBeenCalledWith("new", " Exact new description ");
});
it("reuses a created chat and message ID on retry and sends the description verbatim", async () => {
  const user = userEvent.setup(); const { api, onOpenChat } = fixture();
  api.startTurn.mockRejectedValueOnce(new Error("offline"));
  await selectWork(user);
  await user.click(screen.getByRole("button", { name: "Todo actions" }));
  await user.click(screen.getByRole("button", { name: "Send to..." }));
  await user.click(screen.getByRole("button", { name: /^Bot:/ }));
  expect(screen.getByRole("radio", { name: /bot6/ })).toBeDisabled();
  expect(screen.queryByRole("radio", { name: "claudiothe" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("radio", { name: "bot3/acc1" }));
  await user.click(screen.getByRole("button", { name: "Send" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to send");
  expect(screen.getByRole("button", { name: /^Bot:/ })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(onOpenChat).toHaveBeenCalledWith({ accountId: "bot3/acc1", threadId: "new-chat" }));
  expect(api.startThread).toHaveBeenCalledTimes(1);
  expect(api.startTurn.mock.calls[0]).toEqual(api.startTurn.mock.calls[1]);
  expect(api.startTurn.mock.calls[1]).toEqual(["bot3/acc1", "new-chat", task.description, undefined, expect.any(String)]);
});

it("keeps the send dialog open while dispatch is pending", async () => {
  const user = userEvent.setup(); const { api, onOpenChat } = fixture();
  let finish!: (value: { data: { queued: boolean } }) => void;
  api.startTurn.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await selectWork(user);
  await user.click(screen.getByRole("button", { name: "Todo actions" }));
  await user.click(screen.getByRole("button", { name: "Send to..." }));
  await user.click(screen.getByRole("button", { name: "Send" }));
  await user.keyboard("{Escape}");
  try { expect(screen.getByRole("button", { name: "Sending…" })).toBeVisible(); }
  finally { finish({ data: { queued: true } }); }
  await waitFor(() => expect(onOpenChat).toHaveBeenCalledTimes(1));
});

it("retains a description draft after a failed save", async () => {
  const user = userEvent.setup(); const { api } = fixture();
  api.editQueuedTask.mockRejectedValueOnce(new Error("Unable to save"));
  await selectWork(user);
  await user.click(screen.getByRole("button", { name: "Edit description" }));
  await user.clear(screen.getByLabelText("Description"));
  await user.type(screen.getByLabelText("Description"), " Unsaved work ");
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to save");
  expect(screen.getByLabelText("Description")).toHaveValue(" Unsaved work ");
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByText("Unsaved work")).toBeVisible();
});
