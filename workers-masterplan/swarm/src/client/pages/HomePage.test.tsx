import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CoordinatorSnapshot } from "../../shared/contracts.js";
import { HomePage, LaunchDialog } from "./HomePage";
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

  it("renders normalized active, ready, queue, account, and attention state", () => {
    render(<HomePage snapshot={dashboardSnapshot} api={{ previewLaunch: async () => ({ data: { task: dashboardSnapshot.tasks[1], accountId: "bot3", prompt: "UI prompt", dependencies: ["T0"], concurrencyImpact: "Uses 2 of 3 active turns" } }), launch: successfulLaunch }} />);

    expect(screen.getByText("Active", { selector: "dt" }).nextElementSibling).toHaveTextContent("1");
    expect(screen.getByText("Ready", { selector: "dt" }).nextElementSibling).toHaveTextContent("1");
    expect(screen.getByText("Queue", { selector: "dt" }).nextElementSibling).toHaveTextContent("1");
    expect(screen.getByText("Blocked / attention", { selector: "dt" }).nextElementSibling).toHaveTextContent("2");
    expect(screen.getByRole("heading", { name: "bot3" })).toBeVisible();
    expect(screen.getByLabelText("bot3 connected")).toBeVisible();
    expect(screen.getByLabelText("bot3: five-hour remaining 60%; weekly remaining 80%")).toBeVisible();
    expect(screen.getByRole("heading", { name: "bot1" })).toBeVisible();
    expect(screen.getByLabelText("bot1: five-hour remaining unknown; weekly remaining unknown")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Active work" })).toBeVisible();
    expect(screen.getByText("Task: T0 · Graph planning")).toBeVisible();
    expect(screen.getByText("Worker: Not reported")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Blocked work" })).toBeVisible();
    expect(screen.getByText("I0 · Integration")).toBeVisible();
    expect(screen.getByText("PLANNING_GATE")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Review launch for I0" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Suggested account:/i)).not.toBeInTheDocument();
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

  it("opens an editable ready-worker review with phase, dependencies, account selection, and concurrency impact", async () => {
    const user = userEvent.setup();
    render(<HomePage snapshot={dashboardSnapshot} api={{ previewLaunch: async () => ({ data: { task: dashboardSnapshot.tasks[1], accountId: "bot3", prompt: "Implement the responsive coordinator UI.", dependencies: ["T0"], concurrencyImpact: "Uses 2 of 3 active turns", accounts: [{ id: "bot1", activeWorkers: 0, available: true }, { id: "bot3", activeWorkers: 2, available: true }, { id: "bot2", activeWorkers: 1, available: false }] } }), launch: successfulLaunch }} />);

    await user.click(screen.getByRole("button", { name: "Review launch for U1" }));

    const dialog = await screen.findByRole("dialog", { name: "Launch U1" });
    expect(within(dialog).getByRole("button", { name: "Close" })).toHaveClass("overlay-close-button");
    expect(dialog).toHaveTextContent("UI");
    expect(dialog).toHaveTextContent("T0");
    expect(dialog).toHaveTextContent("bot3");
    expect(dialog).not.toHaveTextContent("Concurrency");
    expect(screen.getByLabelText("Account")).toHaveValue("bot3");
    expect(screen.getByRole("option", { name: /bot1.*0 workers/i })).toBeEnabled();
    expect(screen.getByRole("option", { name: /bot2.*1 worker.*unavailable/i })).toBeDisabled();
    expect(screen.getByLabelText("Worker prompt")).toHaveValue("Implement the responsive coordinator UI.");
    expect(screen.getByRole("button", { name: "Send to bot3" })).toBeEnabled();
  });

  it("opens a review shell immediately while the launch preview is still loading", async () => {
    const user = userEvent.setup();
    let resolvePreview: ((value: Awaited<ReturnType<typeof successfulPreview>>) => void) | undefined;
    const successfulPreview = async () => ({ data: { task: dashboardSnapshot.tasks[1], accountId: "bot3" as const, prompt: "UI prompt", dependencies: ["T0"], accounts: [{ id: "bot3" as const, activeWorkers: 0, available: true }] } });
    const previewLaunch = vi.fn(() => new Promise<Awaited<ReturnType<typeof successfulPreview>>>((resolve) => { resolvePreview = resolve; }));
    render(<HomePage snapshot={dashboardSnapshot} api={{ previewLaunch, launch: successfulLaunch }} />);

    await user.click(screen.getByRole("button", { name: "Review launch for U1" }));

    expect(screen.getByRole("dialog", { name: "Review launch U1" })).toBeVisible();
    expect(screen.getByRole("status", { name: "Loading launch preview" })).toBeVisible();
    resolvePreview?.(await successfulPreview());
    expect(await screen.findByRole("dialog", { name: "Launch U1" })).toHaveClass("launch-dialog--review");
  });

  it.each(["blocked", "attention_required", "complete"] as const)("keeps %s work reviewable but disables Send", async (state) => {
    const task = { ...dashboardSnapshot.tasks[1], readiness: { ...dashboardSnapshot.tasks[1].readiness, state } };
    render(<LaunchDialog preview={{ task, accountId: "bot3", prompt: "Review this prompt.", dependencies: task.dependsOn, accounts: [{ id: "bot3", activeWorkers: 0, available: true }] }} onClose={() => undefined} onSend={async () => undefined} onSelectAccount={async () => undefined} />);

    expect(screen.getByRole("button", { name: "Send to bot3" })).toBeDisabled();
    expect(screen.getByText(new RegExp(`current state: ${state.replaceAll("_", " ")}\\.$`, "i"))).toBeVisible();
  });

  it("uses the chat composer turn options in launch review and sends every selected option", async () => {
    const user = userEvent.setup();
    const launch = vi.fn(async () => ({ data: launchedDispatch }));
    const listModels = vi.fn(async () => ({ data: [{ model: "gpt-5.3-codex", displayName: "GPT-5.3 Codex", supportedEfforts: ["low", "high"], defaultEffort: "low", serviceTiers: [{ id: "standard", name: "Standard" }, { id: "priority", name: "Fast" }], defaultServiceTier: "standard", isDefault: true }] }));
    render(<HomePage snapshot={dashboardSnapshot} api={{ previewLaunch: async () => ({ data: { task: dashboardSnapshot.tasks[1], accountId: "bot3", prompt: "UI prompt", dependencies: ["T0"], concurrencyImpact: "1 / 3", accounts: [{ id: "bot3", activeWorkers: 0, available: true }] } }), launch, listModels }} />);

    await user.click(screen.getByRole("button", { name: "Review launch for U1" }));
    await user.click(await screen.findByText("Turn options"));
    await screen.findByRole("option", { name: "GPT-5.3 Codex" });
    await user.selectOptions(screen.getByLabelText("Model"), "gpt-5.3-codex");
    await user.selectOptions(screen.getByLabelText("Effort"), "high");
    await user.selectOptions(screen.getByLabelText("Speed"), "priority");
    await user.selectOptions(screen.getByLabelText("Permissions"), "full_access");
    await user.click(screen.getByRole("button", { name: "Send to bot3" }));

    expect(launch).toHaveBeenCalledWith("U1", "bot3", "UI prompt", { model: "gpt-5.3-codex", effort: "high", serviceTier: "priority", permissionMode: "full_access" });
  });

  it("sends the edited prompt to the chosen account and opens the created chat", async () => {
    const user = userEvent.setup();
    const launch = vi.fn(async () => ({ data: { id: "dispatch-new", taskId: "U1", accountId: "bot3" as const, threadId: "thread-new", state: "accepted" as const, clientUserMessageId: "message-new", createdAt: 0, updatedAt: 0, retryAt: null } }));
    const onOpenChat = vi.fn();
    render(<HomePage snapshot={dashboardSnapshot} api={{ previewLaunch: async () => ({ data: { task: dashboardSnapshot.tasks[1], accountId: "bot3", prompt: "UI prompt", dependencies: ["T0"], concurrencyImpact: "Uses 2 of 3 active turns", accounts: [{ id: "bot3", activeWorkers: 0, available: true }] } }), launch }} onOpenChat={onOpenChat} />);

    await user.click(screen.getByRole("button", { name: "Review launch for U1" }));
    expect(await screen.findByText("No unarchived chats")).toBeVisible();
    await user.clear(await screen.findByLabelText("Worker prompt"));
    await user.type(screen.getByLabelText("Worker prompt"), "Use the revised worker prompt.");
    await user.click(screen.getByRole("button", { name: "Send to bot3" }));

    expect(launch).toHaveBeenCalledWith("U1", "bot3", "Use the revised worker prompt.", { model: "gpt-5.6-sol", effort: "xhigh", serviceTier: "standard", permissionMode: "full_access" });
    expect(onOpenChat).toHaveBeenCalledWith({ accountId: "bot3", threadId: "thread-new" });
    expect(screen.queryByRole("dialog", { name: "Launch U1" })).not.toBeInTheDocument();
  });

  it("reports rejected preview and launch requests without leaving the UI pending", async () => {
    const user = userEvent.setup();
    const preview = { task: dashboardSnapshot.tasks[1], accountId: "bot3", prompt: "UI prompt", dependencies: ["T0"], concurrencyImpact: "Uses 2 of 3 active turns" };
    const { rerender } = render(<HomePage snapshot={dashboardSnapshot} api={{ previewLaunch: async () => Promise.reject(new Error("offline")), launch: successfulLaunch }} />);

    await user.click(screen.getByRole("button", { name: "Review launch for U1" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to review this launch.");

    rerender(<HomePage snapshot={dashboardSnapshot} api={{ previewLaunch: async () => ({ data: preview }), launch: async () => Promise.reject(new Error("offline")) }} />);
    await user.click(screen.getByRole("button", { name: "Review launch for U1" }));
    await user.click(await screen.findByRole("button", { name: "Send to bot3" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to send this work.");
    expect(screen.getByRole("dialog", { name: "Launch U1" })).toBeVisible();
  });

  it("contains and restores keyboard focus for the reviewed launch dialog", async () => {
    const user = userEvent.setup();
    render(<HomePage snapshot={dashboardSnapshot} api={{ previewLaunch: async () => ({ data: { task: dashboardSnapshot.tasks[1], accountId: "bot3", prompt: "UI prompt", dependencies: ["T0"], concurrencyImpact: "Uses 2 of 3 active turns" } }), launch: successfulLaunch }} />);

    const trigger = screen.getByRole("button", { name: "Review launch for U1" });
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Launch U1" });
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
  });
});
