import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { AccountSummaryPanel } from "./AccountSummaryPanel";
import { dashboardSnapshot } from "../test/fixtures";
import type { CoordinatorSnapshot } from "../../shared/contracts";

afterEach(cleanup);
const noop = () => undefined;
function props(snapshot: CoordinatorSnapshot) {
  return { accounts: snapshot.accounts, threads: snapshot.threads, limitResumes: snapshot.limitResumes, onViewMore: noop };
}

it("keeps usage compact and lets the operator view all accounts", async () => {
  const user = userEvent.setup();
  const onViewMore = vi.fn();
  const snapshot: CoordinatorSnapshot = { ...dashboardSnapshot, accounts: [{ id: "claudiothe", connection: "connected", authentication: "authenticated", rateLimits: [], activeTurns: 0, lastAssignedAt: null }, ...dashboardSnapshot.accounts] };
  render(<AccountSummaryPanel {...props(snapshot)} onViewMore={onViewMore} />);
  const sidebar = screen.getByRole("complementary", { name: "Accounts" });
  expect(within(sidebar).getAllByRole("heading", { level: 3 })[0]).toHaveTextContent("claudiothe");
  expect(within(sidebar).getByLabelText("claudiothe connected")).toBeVisible();
  expect(within(sidebar).getByLabelText("claudiothe: five-hour remaining unknown; weekly remaining unknown")).toBeVisible();
  expect(screen.getByLabelText("bot3: five-hour remaining 60%; weekly remaining 80%")).toBeVisible();
  expect(screen.queryByLabelText("Five-hour remaining: 60%")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "View more accounts" }));
  expect(onViewMore).toHaveBeenCalledOnce();
});

it("mirrors active work, unread replies and waiting-for-limit status", () => {
  const snapshot: CoordinatorSnapshot = { ...dashboardSnapshot, threads: [{ id: "thread-1", accountId: "bot3", name: "Active", archived: false, updatedAt: 1, activity: "active", capabilities: { canArchive: true, canInterrupt: true, canStartTurn: true, canSteer: true } }], limitResumes: [] };
  const view = render(<AccountSummaryPanel {...props(snapshot)} activeTurnKeys={new Set(["bot3\u0000thread-1"])} unreadTurnKeys={new Set(["bot3\u0000thread-1"])} />);
  expect(screen.getByLabelText("bot3 working")).toHaveClass("chat-account-picker__activity");
  expect(screen.getByLabelText("bot3 has unread replies")).toBeVisible();
  view.rerender(<AccountSummaryPanel {...props({ ...snapshot, threads: snapshot.threads.map(thread => ({ ...thread, activity: "idle" })), limitResumes: [{ accountId: "bot3", threadId: "thread-1", state: "waiting_for_limit", updatedAt: 2 }] })} />);
  expect(screen.getByLabelText("bot3 waiting for limit")).toHaveClass("chat-account-picker__activity--limit");
  expect(screen.getByLabelText("bot1 requires attention").querySelector(".chat-account-picker__status")).toHaveClass("chat-account-picker__status--error");
  expect(screen.queryByLabelText("bot3 has unread replies")).not.toBeInTheDocument();
});

it("colours windows independently and empties five-hour capacity when weekly is exhausted", () => {
  const snapshot: CoordinatorSnapshot = { ...dashboardSnapshot, accounts: [{ ...dashboardSnapshot.accounts[0], rateLimits: [
    { id: "five-hour", label: "Five-hour", usedPercent: 90, resetsAt: null, updatedAt: 1 },
    { id: "weekly", label: "Weekly", usedPercent: 20, resetsAt: null, updatedAt: 1 },
  ] }] };
  const view = render(<AccountSummaryPanel {...props(snapshot)} />);
  const layered = screen.getByLabelText("bot3: five-hour remaining 10%; weekly remaining 80%");
  expect(layered.querySelector(".account-summary__five-hour")).toHaveClass("usage-tone--critical");
  expect(layered.querySelector(".account-summary__weekly")).toHaveClass("usage-tone--healthy");
  expect(Number((layered.querySelector(".account-summary__weekly") as HTMLElement).style.opacity)).toBeLessThan(1);
  view.rerender(<AccountSummaryPanel {...props({ ...snapshot, accounts: [{ ...snapshot.accounts[0], rateLimits: [
    { id: "five-hour", label: "Five-hour", usedPercent: 10, resetsAt: null, updatedAt: 1 },
    { id: "weekly", label: "Weekly", usedPercent: 100, resetsAt: null, updatedAt: 1 },
  ] }] })} />);
  const exhausted = screen.getByLabelText("bot3: five-hour remaining 0%; weekly remaining 0%");
  expect(exhausted.querySelector(".account-summary__five-hour")).toHaveStyle({ width: "0%" });
  expect(exhausted.querySelector(".account-summary__weekly")).toHaveClass("usage-tone--critical");
});

it("refreshes account usage", async () => {
  const refresh = vi.fn(async () => undefined);
  render(<AccountSummaryPanel {...props(dashboardSnapshot)} onRefreshUsage={refresh} />);
  await userEvent.click(screen.getByRole("button", { name: "Refresh usage" }));
  expect(refresh).toHaveBeenCalledOnce();
});

it("opens the selected account's chats", async () => {
  const open = vi.fn();
  render(<AccountSummaryPanel {...props(dashboardSnapshot)} onOpenAccountChat={open} />);
  await userEvent.click(screen.getByRole("button", { name: "Open chats for bot3" }));
  expect(open).toHaveBeenCalledWith("bot3");
});

it("keeps local workspace metadata out of account rows", () => {
  const snapshot: CoordinatorSnapshot = { ...dashboardSnapshot, localWorkspace: { label: "claudiothe (local)", gitSync: { state: "warning", action: "pull", lastAttemptAt: 1, message: "Git pull failed." } } };
  render(<AccountSummaryPanel {...props(snapshot)} />);
  expect(within(screen.getByRole("complementary", { name: "Accounts" })).getAllByRole("heading", { level: 3 })).toHaveLength(snapshot.accounts.length);
  expect(screen.queryByText("claudiothe (local)")).not.toBeInTheDocument();
});
