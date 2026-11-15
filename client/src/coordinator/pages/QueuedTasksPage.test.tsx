import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { QueuedTasksPage } from "./QueuedTasksPage.js";
import type { CoordinatorApi } from "../api.js";

vi.mock("../store/coordinatorStore.js", () => ({ useCoordinatorStore: () => ({ snapshot: { accounts: [
  { id: "bot3/acc1", connection: "connected", authentication: "authenticated" },
  { id: "bot6/acc1", connection: "disconnected", authentication: "unknown" },
  { id: "claudiothe", connection: "connected", authentication: "authenticated" },
] } }) }));
afterEach(cleanup);
const task = { id: "todo-1", title: "Investigate login", prompt: "Find and fix the login error.", completed: false };
function fixture() {
  const api = {
    listQueuedTasks: vi.fn(async () => ({ data: [task] })),
    editQueuedTask: vi.fn(async (_id: string, title: string, prompt: string) => ({ data: [{ ...task, title, prompt }] })),
    deleteQueuedTask: vi.fn(async () => ({ data: [] })),
    startThread: vi.fn(async () => ({ data: { id: "new-chat", accountId: "bot3/acc1" } })),
    renameThread: vi.fn(async () => ({ data: {} })),
    startTurn: vi.fn(async (..._args: unknown[]) => ({ data: { queued: true } })),
  };
  const onOpenChat = vi.fn();
  render(<QueuedTasksPage api={api as unknown as CoordinatorApi} onOpenChat={onOpenChat} />);
  return { api, onOpenChat };
}
it("edits title and prompt, then deletes a todo through labeled icon buttons", async () => {
  const user = userEvent.setup(); const { api } = fixture();
  await user.click(await screen.findByRole("button", { name: `Edit ${task.title}` }));
  await user.clear(screen.getByLabelText("Edit title")); await user.type(screen.getByLabelText("Edit title"), "Updated title");
  await user.clear(screen.getByLabelText("Edit prompt")); await user.type(screen.getByLabelText("Edit prompt"), "Updated prompt");
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  expect(api.editQueuedTask).toHaveBeenCalledWith(task.id, "Updated title", "Updated prompt");
  await user.click(await screen.findByRole("button", { name: "Delete Updated title" }));
  expect(api.deleteQueuedTask).toHaveBeenCalledWith(task.id);
  expect(await screen.findByText("No queued tasks yet.")).toBeVisible();
});
it("starts a new chat on the selected bot, names it and submits its prompt", async () => {
  const user = userEvent.setup(); const { api, onOpenChat } = fixture();
  await user.click(await screen.findByRole("button", { name: `Send ${task.title} to bot` }));
  await user.click(screen.getByRole("button", { name: /^Bot:/ }));
  expect(screen.getByRole("radio", { name: /bot6/ })).toBeDisabled();
  expect(screen.queryByRole("radio", { name: "claudiothe" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("radio", { name: "bot3/acc1" }));
  await user.click(screen.getByRole("button", { name: "Send prompt" }));
  await waitFor(() => expect(onOpenChat).toHaveBeenCalledWith({ accountId: "bot3/acc1", threadId: "new-chat" }));
  expect(api.startThread).toHaveBeenCalledWith("bot3/acc1");
  expect(api.renameThread).toHaveBeenCalledWith("bot3/acc1", "new-chat", task.title);
  expect(api.startTurn).toHaveBeenCalledWith("bot3/acc1", "new-chat", task.prompt, undefined, expect.any(String));
});
it("reuses the created chat and message ID when a send fails and is retried", async () => {
  const user = userEvent.setup(); const { api } = fixture();
  api.startTurn.mockRejectedValueOnce(new Error("offline"));
  await user.click(await screen.findByRole("button", { name: `Send ${task.title} to bot` }));
  await user.click(screen.getByRole("button", { name: "Send prompt" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to send");
  await user.click(screen.getByRole("button", { name: "Send prompt" }));
  await waitFor(() => expect(api.startTurn).toHaveBeenCalledTimes(2));
  expect(api.startThread).toHaveBeenCalledTimes(1);
  expect(api.startTurn.mock.calls[0]).toEqual(api.startTurn.mock.calls[1]);
});
