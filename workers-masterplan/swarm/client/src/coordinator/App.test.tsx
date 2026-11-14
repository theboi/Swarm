import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { setViewport, snapshot } from "./test/fixtures";
import type { CoordinatorApi } from "./api";

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, "ResizeObserver", { configurable: true, value: TestResizeObserver });

const api: CoordinatorApi = {
  listQueuedTasks: async () => ({ data: [] }),
  addQueuedTask: async () => ({ data: [] }),
  editQueuedTask: async () => ({ data: [] }),
  deleteQueuedTask: async () => ({ data: [] }),
  completeQueuedTask: async () => ({ data: [] }),
  getSession: async () => ({ authenticated: true }),
  getSnapshot: async () => snapshot,
  setAutoPilot: async () => ({ data: { enabled: false } }),
  setLimitResumeEnabled: async (_accountId, _threadId, enabled) => ({ data: { enabled } }),
  makePrimary: async () => ({ data: [] }),
  addAccount: async () => ({ data: { id: "bot1/acc2", macosUser: "bot1", accountNumber: 2, connection: "disconnected", authentication: "unknown", rateLimits: [], activeTurns: 0, lastAssignedAt: null } }),
  startAccountLogin: async () => ({ data: { accountId: "bot1/acc2", method: "device_code", verificationUrl: "https://auth.example.test", userCode: "ABCD-EFGH", expiresAt: 1 } }),
  cancelAccountLogin: async () => ({ data: {} }),
  startLogin: async () => ({ data: { challengeId: "challenge" } }),
  completeLogin: async () => ({ data: { authenticated: true } }),
  previewLaunch: async () => ({ error: { code: "TASK_NOT_READY", message: "Not ready" } }),
  launch: async () => ({ data: { id: "dispatch", clientUserMessageId: "message", taskId: "U1", accountId: "bot3", threadId: "thread", state: "accepted", createdAt: 0, updatedAt: 0, retryAt: null } }),
  connectAccount: async () => ({ data: {} }),
  refreshAllRateLimits: async () => ({ data: {} }),
  listModels: async () => ({ data: [] }),
  listThreads: async () => ({ data: snapshot.threads }),
  openTerminal: async () => ({ data: {} }),
  startThread: async () => ({ data: { id: "thread", accountId: "bot3", name: null, archived: false, updatedAt: 0, capabilities: { canArchive: false, canInterrupt: false, canStartTurn: false, canSteer: false } } }),
  moveThreadToAccount: async () => ({ data: { id: "thread", accountId: "bot3", name: null, archived: false, updatedAt: 0, capabilities: { canArchive: false, canInterrupt: false, canStartTurn: false, canSteer: false } } }),
  renameThread: async () => ({ data: {} }),
  archiveThread: async () => ({ data: {} }),
  startTurn: async () => ({ data: {} }),
  steerTurn: async () => ({ data: {} }),
  interruptTurn: async () => ({ data: {} }),
  readTranscript: async () => ({ data: [] }),
  readMarkdown: async () => ({ data: { filename: "readme.md", content: "# Readme" } }),
  decideApproval: async () => ({ data: {} }),
};

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/home");
});

describe("App", () => {
  it("navigates between the labeled Home, Queued tasks, and Chats screens by keyboard", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    render(<App api={api} />);

    await screen.findByRole("heading", { name: "Home" });
    screen.getByRole("link", { name: "Queued tasks" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("region", { name: "Queued tasks" })).toBeVisible();

    screen.getByRole("link", { name: "Chats" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("region", { name: "Chats" })).toBeVisible();
  });

  it("passes the account terminal action from the app shell to Home", async () => {
    const user = userEvent.setup();
    const openTerminal = vi.fn(async () => ({ data: {} }));
    render(<App api={{ ...api, openTerminal }} />);

    await user.click(await screen.findByRole("button", { name: "View more accounts" }));
    expect(await screen.findByRole("heading", { name: "Accounts" })).toBeVisible();
    expect(screen.getByLabelText("Five-hour remaining: 60%")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Open terminal for bot3" }));

    expect(openTerminal).toHaveBeenCalledWith("bot3");
  });

  it("reports a rejected normalized snapshot instead of remaining indefinitely loading", async () => {
    render(<App api={{ ...api, getSnapshot: async () => Promise.reject(new Error("offline")) }} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load coordinator snapshot.");
  });

  it("uses the current canonical location as its initial page", async () => {
    window.history.replaceState(null, "", "/accounts");
    render(<App api={api} />);

    expect(await screen.findByRole("button", { name: "Open terminal for bot3" })).toBeVisible();
  });

  it("uses canonical primary links for in-app navigation", async () => {
    const user = userEvent.setup();
    render(<App api={api} />);

    const queue = await screen.findByRole("link", { name: "Queued tasks" });
    expect(queue).toHaveAttribute("href", "/queued-tasks");
    await user.click(queue);

    expect(screen.getByRole("region", { name: "Queued tasks" })).toBeVisible();
    expect(window.location.pathname).toBe("/queued-tasks");
  });

  it("adds a todo with its title and prompt", async () => {
    const user = userEvent.setup();
    const task = { id: "todo-1", title: "Fix login", prompt: "Investigate the login error", completed: false };
    const addQueuedTask = vi.fn(async () => ({ data: [task] }));
    render(<App api={{ ...api, addQueuedTask }} />);
    await user.click(await screen.findByRole("link", { name: "Queued tasks" }));
    await screen.findByText("No queued tasks yet.");
    await user.type(screen.getByLabelText("Title"), task.title);
    await user.type(screen.getByLabelText("Prompt"), task.prompt);
    await user.click(screen.getByRole("button", { name: "Add todo" }));
    expect(addQueuedTask).toHaveBeenCalledWith(task.title, task.prompt);
    expect(await screen.findByText(task.title)).toBeVisible();
    expect(screen.getByText(task.prompt)).toBeVisible();
  });

  it("uses popstate to restore a prior canonical page", async () => {
    window.history.replaceState(null, "", "/queued-tasks");
    render(<App api={api} />);
    await screen.findByRole("region", { name: "Queued tasks" });

    await act(async () => {
      window.history.replaceState(null, "", "/accounts");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(screen.getByRole("heading", { name: "Accounts" })).toBeVisible();
  });

  it("replaces an unknown location with the canonical Home path", async () => {
    window.history.replaceState(null, "", "/not-a-dashboard-page");
    render(<App api={api} />);

    expect(await screen.findByText("Operating cockpit")).toBeVisible();
    expect(window.location.pathname).toBe("/home");
  });

  it("opens a fresh file-query deep link through the local account", async () => {
    window.history.replaceState(null, "", "/?file=docs%2Frunbook.md");
    const pushState = vi.spyOn(window.history, "pushState");
    const readMarkdown = vi.fn(async () => ({ data: { filename: "runbook.md", content: "# Runbook" } }));
    const localSnapshot = { ...snapshot, accounts: [{ ...snapshot.accounts[0], id: "claudiothe" as const }] };
    render(<App api={{ ...api, getSnapshot: async () => localSnapshot, readMarkdown }} />);

    expect(await screen.findByRole("dialog", { name: "runbook.md" })).toBeVisible();
    expect(readMarkdown).toHaveBeenCalledWith("claudiothe", "docs/runbook.md");
    expect(pushState).not.toHaveBeenCalled();
  });
});
