import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { HomePage } from "./HomePage";
import { dashboardSnapshot } from "../test/fixtures";

afterEach(cleanup);

describe("HomePage", () => {
  it("renders normalized active, ready, queue, account, attention, and scheduled-access state", () => {
    render(<HomePage snapshot={dashboardSnapshot} api={{ previewLaunch: async () => ({ data: { task: dashboardSnapshot.tasks[1], accountId: "bot3", prompt: "UI prompt", dependencies: ["T0"], concurrencyImpact: "Uses 2 of 3 active turns" } }), launch: async () => ({ data: {} }) }} />);

    expect(screen.getByText("Active", { selector: "dt" }).nextElementSibling).toHaveTextContent("1");
    expect(screen.getByText("Ready", { selector: "dt" }).nextElementSibling).toHaveTextContent("1");
    expect(screen.getByText("Queue", { selector: "dt" }).nextElementSibling).toHaveTextContent("1");
    expect(screen.getByText("Blocked / attention", { selector: "dt" }).nextElementSibling).toHaveTextContent("2");
    expect(screen.getByRole("heading", { name: "bot3" })).toBeVisible();
    expect(screen.getByLabelText("Five-hour remaining: 60%")).toBeVisible();
    expect(screen.getByLabelText("Weekly remaining: 80%")).toBeVisible();
    expect(screen.getByRole("heading", { name: "bot1" })).toBeVisible();
    expect(screen.getAllByText("Unknown")).not.toHaveLength(0);
    expect(screen.getByText("Action required: sign in to this account.")).toBeVisible();
    expect(screen.getByText("rm -rf /Users/bot4")).toBeVisible();
    expect(screen.getByText("Public access starts at 10:00")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Active work" })).toBeVisible();
    expect(screen.getByText("Task: T0 · Graph planning")).toBeVisible();
    expect(screen.getByText("Worker: Not reported")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Blocked work" })).toBeVisible();
    expect(screen.getByText("I0 · Integration")).toBeVisible();
    expect(screen.getByText("PLANNING_GATE")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Review launch for I0" })).not.toBeInTheDocument();
  });

  it("renders the normalized ngrok public URL only when the coordinator reports one", () => {
    render(<HomePage snapshot={{ ...dashboardSnapshot, ngrok: { ...dashboardSnapshot.ngrok, state: "running", publicUrl: "https://edenmind.example.ngrok.app" } }} api={{ previewLaunch: async () => ({ error: { code: "TASK_NOT_READY", message: "Not ready" } }), launch: async () => ({ data: {} }) }} />);

    expect(screen.getByRole("link", { name: "https://edenmind.example.ngrok.app" })).toHaveAttribute("href", "https://edenmind.example.ngrok.app");
  });

  it("opens a ready worker launch preview with phase, dependencies, account, and concurrency impact", async () => {
    const user = userEvent.setup();
    render(<HomePage snapshot={dashboardSnapshot} api={{ previewLaunch: async () => ({ data: { task: dashboardSnapshot.tasks[1], accountId: "bot3", prompt: "Implement the responsive coordinator UI.", dependencies: ["T0"], concurrencyImpact: "Uses 2 of 3 active turns" } }), launch: async () => ({ data: {} }) }} />);

    await user.click(screen.getByRole("button", { name: "Review launch for U1" }));

    const dialog = await screen.findByRole("dialog", { name: "Launch U1" });
    expect(dialog).toHaveTextContent("UI");
    expect(dialog).toHaveTextContent("T0");
    expect(dialog).toHaveTextContent("bot3");
    expect(dialog).toHaveTextContent("Uses 2 of 3 active turns");
    expect(screen.getByRole("button", { name: "Launch" })).toBeEnabled();
  });

  it("confirms a submitted launch after the reviewed Launch action", async () => {
    const user = userEvent.setup();
    render(<HomePage snapshot={dashboardSnapshot} api={{ previewLaunch: async () => ({ data: { task: dashboardSnapshot.tasks[1], accountId: "bot3", prompt: "UI prompt", dependencies: ["T0"], concurrencyImpact: "Uses 2 of 3 active turns" } }), launch: async () => ({ data: {} }) }} />);

    await user.click(screen.getByRole("button", { name: "Review launch for U1" }));
    await user.click(await screen.findByRole("button", { name: "Launch" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Launch submitted for U1.");
    expect(screen.queryByRole("dialog", { name: "Launch U1" })).not.toBeInTheDocument();
  });

  it("reports rejected preview and launch requests without leaving the UI pending", async () => {
    const user = userEvent.setup();
    const preview = { task: dashboardSnapshot.tasks[1], accountId: "bot3", prompt: "UI prompt", dependencies: ["T0"], concurrencyImpact: "Uses 2 of 3 active turns" };
    const { rerender } = render(<HomePage snapshot={dashboardSnapshot} api={{ previewLaunch: async () => Promise.reject(new Error("offline")), launch: async () => ({ data: {} }) }} />);

    await user.click(screen.getByRole("button", { name: "Review launch for U1" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to review this launch.");

    rerender(<HomePage snapshot={dashboardSnapshot} api={{ previewLaunch: async () => ({ data: preview }), launch: async () => Promise.reject(new Error("offline")) }} />);
    await user.click(screen.getByRole("button", { name: "Review launch for U1" }));
    await user.click(await screen.findByRole("button", { name: "Launch" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to submit this launch.");
    expect(screen.getByRole("dialog", { name: "Launch U1" })).toBeVisible();
  });

  it("contains and restores keyboard focus for the reviewed launch dialog", async () => {
    const user = userEvent.setup();
    render(<HomePage snapshot={dashboardSnapshot} api={{ previewLaunch: async () => ({ data: { task: dashboardSnapshot.tasks[1], accountId: "bot3", prompt: "UI prompt", dependencies: ["T0"], concurrencyImpact: "Uses 2 of 3 active turns" } }), launch: async () => ({ data: {} }) }} />);

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
