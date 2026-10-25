import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CoordinatorSnapshot } from "../../shared/contracts.js";
import { HomePage } from "./HomePage";
import { dashboardSnapshot } from "../test/fixtures";

const launchedDispatch = { id: "dispatch-test", clientUserMessageId: "message-test", taskId: "U1", accountId: "bot3" as const, threadId: "thread-test", state: "accepted" as const, createdAt: 0, updatedAt: 0, retryAt: null };
const successfulLaunch = async () => ({ data: launchedDispatch });

afterEach(cleanup);

describe("HomePage", () => {
  it("keeps account usage compact in the dashboard sidebar and lets you view all accounts", async () => {
    const user = userEvent.setup();
    const onViewAccounts = vi.fn();
    const api = {
      previewLaunch: async () => ({ error: { code: "TASK_NOT_READY", message: "Not ready" } }),
      launch: successfulLaunch,
    };
    const localFirstSnapshot: CoordinatorSnapshot = {
      ...dashboardSnapshot,
      accounts: [{ id: "claudiothe", connection: "connected", authentication: "authenticated", rateLimits: [], activeTurns: 0, lastAssignedAt: null }, ...dashboardSnapshot.accounts],
    };
    render(<HomePage snapshot={localFirstSnapshot} api={api} onViewAccounts={onViewAccounts} />);

    const sidebar = screen.getByLabelText("Accounts").closest("aside");
    expect(sidebar).toBeInTheDocument();
    expect(sidebar).toHaveClass("account-summary-card");
    expect(within(sidebar as HTMLElement).getAllByRole("heading", { level: 3 })[0]).toHaveTextContent("claudiothe");
    expect(within(sidebar as HTMLElement).getByLabelText("claudiothe connected")).toBeVisible();
    expect(within(sidebar as HTMLElement).queryByText("connected", { exact: true })).not.toBeInTheDocument();
    expect(within(sidebar as HTMLElement).getByLabelText("claudiothe: five-hour remaining unknown; weekly remaining unknown")).toBeVisible();
    expect(screen.getByLabelText("bot3: five-hour remaining 60%; weekly remaining 80%")).toBeVisible();
    expect(screen.queryByLabelText("Five-hour remaining: 60%")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "View more accounts" }));

    expect(onViewAccounts).toHaveBeenCalledOnce();
  });

  it("uses the chat account activity icon and mirrors unread chat notifications", () => {
    const api = { previewLaunch: async () => ({ error: { code: "TASK_NOT_READY", message: "Not ready" } }), launch: successfulLaunch };
    const activeSnapshot: CoordinatorSnapshot = {
      ...dashboardSnapshot,
      threads: [{ id: "thread-1", accountId: "bot3", name: "Active", archived: false, updatedAt: 1, activity: "active", capabilities: { canArchive: true, canInterrupt: true, canStartTurn: true, canSteer: true } }],
      limitResumes: [],
    };

    const view = render(<HomePage snapshot={activeSnapshot} api={api} activeTurnKeys={new Set(["bot3\u0000thread-1"])} unreadTurnKeys={new Set(["bot3\u0000thread-1"])} />);
    expect(screen.getByLabelText("bot3 working")).toHaveClass("chat-account-picker__activity");
    expect(screen.getByLabelText("bot3 working").querySelector(".chat-account-picker__status")).toHaveClass("chat-account-picker__status--connected");
    expect(screen.getByLabelText("bot3 has unread replies")).toBeVisible();

    view.rerender(<HomePage snapshot={{ ...activeSnapshot, threads: activeSnapshot.threads.map((thread) => ({ ...thread, activity: "idle" as const })), limitResumes: [{ accountId: "bot3", threadId: "thread-1", state: "waiting_for_limit", updatedAt: 2 }] }} api={api} activeTurnKeys={new Set()} unreadTurnKeys={new Set()} />);
    expect(screen.getByLabelText("bot3 waiting for limit")).toHaveClass("chat-account-picker__activity--limit");
    expect(screen.getByLabelText("bot1 requires attention").querySelector(".chat-account-picker__status")).toHaveClass("chat-account-picker__status--error");
    expect(screen.queryByLabelText("bot3 has unread replies")).not.toBeInTheDocument();
  });

  it("colors each overlaid limit independently and empties five-hour capacity when weekly is exhausted", () => {
    const api = { previewLaunch: async () => ({ error: { code: "TASK_NOT_READY", message: "Not ready" } }), launch: successfulLaunch };
    const coloredSnapshot: CoordinatorSnapshot = {
      ...dashboardSnapshot,
      accounts: [{ ...dashboardSnapshot.accounts[0], rateLimits: [
        { id: "five-hour", label: "Five-hour", usedPercent: 90, resetsAt: null, updatedAt: 1 },
        { id: "weekly", label: "Weekly", usedPercent: 20, resetsAt: null, updatedAt: 1 },
      ] }],
    };
    const { rerender } = render(<HomePage snapshot={coloredSnapshot} api={api} />);

    const layered = screen.getByLabelText("bot3: five-hour remaining 10%; weekly remaining 80%");
    expect(layered.querySelector(".account-summary__five-hour")).toHaveClass("usage-tone--critical");
    expect(layered.querySelector(".account-summary__weekly")).toHaveClass("usage-tone--healthy");
    const rearOpacity = (layered.querySelector(".account-summary__weekly") as HTMLElement).style.opacity;
    expect(rearOpacity).not.toBe("");
    expect(Number(rearOpacity)).toBeLessThan(1);

    rerender(<HomePage snapshot={{ ...coloredSnapshot, accounts: [{ ...coloredSnapshot.accounts[0], rateLimits: [
      { id: "five-hour", label: "Five-hour", usedPercent: 10, resetsAt: null, updatedAt: 1 },
      { id: "weekly", label: "Weekly", usedPercent: 100, resetsAt: null, updatedAt: 1 },
    ] }] }} api={api} />);
    const exhausted = screen.getByLabelText("bot3: five-hour remaining 0%; weekly remaining 0%");
    expect(exhausted.querySelector(".account-summary__five-hour")).toHaveStyle({ width: "0%" });
    expect(exhausted.querySelector(".account-summary__weekly")).toHaveClass("usage-tone--critical");
  });

  it("lets the operator refresh every account's usage from the dashboard", async () => {
    const user = userEvent.setup();
    const refreshUsage = vi.fn(async () => undefined);
    render(<HomePage snapshot={dashboardSnapshot} api={{ previewLaunch: async () => ({ error: { code: "TASK_NOT_READY", message: "Not ready" } }), launch: successfulLaunch }} onRefreshUsage={refreshUsage} />);

    await user.click(screen.getByRole("button", { name: "Refresh usage" }));

    expect(refreshUsage).toHaveBeenCalledOnce();
  });

  it("opens the selected account's chats from its compact dashboard row", async () => {
    const user = userEvent.setup();
    const onOpenAccountChat = vi.fn();
    render(<HomePage snapshot={dashboardSnapshot} api={{ previewLaunch: async () => ({ error: { code: "TASK_NOT_READY", message: "Not ready" } }), launch: successfulLaunch }} onOpenAccountChat={onOpenAccountChat} />);

    await user.click(screen.getByRole("button", { name: "Open chats for bot3" }));

    expect(onOpenAccountChat).toHaveBeenCalledWith("bot3");
  });

  it("shows approvals and accounts without task assignment controls", () => {
    render(<HomePage snapshot={dashboardSnapshot} api={{ previewLaunch: async () => ({ error: { code: "TASK_NOT_READY", message: "Retired" } }), launch: successfulLaunch }} />);
    expect(screen.getByRole("heading", { name: "Attention queue" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Next ready work" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Review launch/ })).not.toBeInTheDocument();
  });

  it("keeps the local workspace status out of the compact account rows", () => {
    const localSnapshot: CoordinatorSnapshot = {
      ...dashboardSnapshot,
      localWorkspace: { label: "claudiothe (local)", gitSync: { state: "warning", action: "pull", lastAttemptAt: 1, message: "Git pull failed." } },
    };
    render(<HomePage snapshot={localSnapshot} api={{ previewLaunch: async () => ({ error: { code: "TASK_NOT_READY", message: "Not ready" } }), launch: successfulLaunch }} />);

    const cards = within(screen.getByLabelText("Accounts")).getAllByRole("heading", { level: 3 });
    expect(cards).toHaveLength(localSnapshot.accounts.length);
    expect(screen.queryByText("claudiothe (local)")).not.toBeInTheDocument();
  });

});
