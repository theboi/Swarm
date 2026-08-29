import { cleanup, render, screen } from "@testing-library/react";
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
  getSession: async () => ({ authenticated: true }),
  getSnapshot: async () => snapshot,
  startLogin: async () => ({ data: { challengeId: "challenge" } }),
  completeLogin: async () => ({ data: { authenticated: true } }),
  previewLaunch: async () => ({ error: { code: "TASK_NOT_READY", message: "Not ready" } }),
  launch: async () => ({ data: { id: "dispatch", clientUserMessageId: "message", taskId: "U1", accountId: "bot3", threadId: "thread", state: "accepted", createdAt: 0, updatedAt: 0, retryAt: null } }),
  connectAccount: async () => ({ data: {} }),
  refreshAllRateLimits: async () => ({ data: {} }),
  listModels: async () => ({ data: [] }),
  openTerminal: async () => ({ data: {} }),
  startThread: async () => ({ data: { id: "thread", accountId: "bot3", name: null, archived: false, updatedAt: 0, capabilities: { canArchive: false, canInterrupt: false, canStartTurn: false, canSteer: false } } }),
  moveThreadToAccount: async () => ({ data: { id: "thread", accountId: "bot3", name: null, archived: false, updatedAt: 0, capabilities: { canArchive: false, canInterrupt: false, canStartTurn: false, canSteer: false } } }),
  archiveThread: async () => ({ data: {} }),
  startTurn: async () => ({ data: {} }),
  steerTurn: async () => ({ data: {} }),
  interruptTurn: async () => ({ data: {} }),
  readTranscript: async () => ({ data: [] }),
  readMarkdown: async () => ({ data: { filename: "readme.md", content: "# Readme" } }),
  decideApproval: async () => ({ data: {} }),
};

afterEach(cleanup);

describe("App", () => {
  it("navigates between the labeled Home, Flowchart, and Chats screens by keyboard", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    render(<App api={api} />);

    await screen.findByRole("heading", { name: "Home" });
    screen.getByRole("button", { name: "Flowchart" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { name: "Flowchart" })).toBeVisible();

    screen.getByRole("button", { name: "Chats" }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("region", { name: "Chats" })).toBeVisible();
  });

  it("uses the approved dark canvas by default", async () => {
    setViewport(1440);
    render(<App api={api} />);

    const shell = await screen.findByTestId("app-shell");
    expect(getComputedStyle(shell).backgroundColor).toBe("rgb(21, 25, 27)");
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
});
