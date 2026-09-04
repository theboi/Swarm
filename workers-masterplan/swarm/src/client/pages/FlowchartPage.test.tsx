import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FlowchartPage, taskLayoutPositions } from "./FlowchartPage";
import { dashboardSnapshot, setViewport } from "../test/fixtures";

class TestResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(target: Element) {
    this.callback([{ target, contentRect: { width: 960, height: 560, x: 0, y: 0, top: 0, left: 0, right: 960, bottom: 560, toJSON: () => ({}) } } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}

class TestDOMMatrixReadOnly {
  readonly m22: number;
  constructor(transform?: string) {
    const match = transform?.match(/scale\(([^)]+)\)/);
    this.m22 = match ? Number(match[1]) : 1;
  }
}

Object.defineProperty(globalThis, "ResizeObserver", { configurable: true, value: TestResizeObserver });
Object.defineProperty(window, "DOMMatrixReadOnly", { configurable: true, value: TestDOMMatrixReadOnly });
Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get() { return this.getAttribute("data-id") ? 180 : 960; } });
Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get() { return this.getAttribute("data-id") ? 96 : 560; } });
HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
  const width = this.getAttribute("data-id") ? 180 : 960;
  const height = this.getAttribute("data-id") ? 96 : 560;
  return { width, height, x: 0, y: 0, top: 0, left: 0, right: width, bottom: height, toJSON: () => ({}) } as DOMRect;
};

afterEach(cleanup);

describe("FlowchartPage", () => {
  it("confirms auto-pilot changes with the server and keeps snapshot updates authoritative", async () => {
    const user = userEvent.setup();
    let resolveSetAutoPilot: ((result: { data: { enabled: boolean } }) => void) | undefined;
    const setAutoPilot = vi.fn(() => new Promise<{ data: { enabled: boolean } }>((resolve) => { resolveSetAutoPilot = resolve; }));
    const { rerender } = render(<FlowchartPage snapshot={dashboardSnapshot} api={{ previewLaunch: async () => ({ error: { code: "TASK_NOT_READY", message: "Not ready" } }), launch: async () => ({ error: { code: "TASK_NOT_READY", message: "Not ready" } }), setAutoPilot }} onOpenChat={() => undefined} />);

    const control = screen.getByRole("switch", { name: "Auto-pilot" });
    expect(control).not.toBeChecked();
    expect(screen.getByText("Assign ready work to idle bot accounts")).toBeVisible();

    await user.click(control);
    expect(setAutoPilot).toHaveBeenCalledWith(true);
    expect(control).toBeDisabled();
    expect(control).not.toBeChecked();

    resolveSetAutoPilot?.({ data: { enabled: true } });
    expect(await screen.findByRole("switch", { name: "Auto-pilot", checked: true })).toBeEnabled();

    rerender(<FlowchartPage snapshot={{ ...dashboardSnapshot, autoPilot: { enabled: false } }} api={{ previewLaunch: async () => ({ error: { code: "TASK_NOT_READY", message: "Not ready" } }), launch: async () => ({ error: { code: "TASK_NOT_READY", message: "Not ready" } }), setAutoPilot }} onOpenChat={() => undefined} />);
    expect(screen.getByRole("switch", { name: "Auto-pilot" })).not.toBeChecked();
  });

  it("retains the prior auto-pilot state and shows an alert when the server rejects the change", async () => {
    const user = userEvent.setup();
    const setAutoPilot = vi.fn(async () => ({ error: { code: "AUTO_PILOT_FAILED", message: "Unable to update auto-pilot." } }));
    render(<FlowchartPage snapshot={{ ...dashboardSnapshot, autoPilot: { enabled: true } }} api={{ previewLaunch: async () => ({ error: { code: "TASK_NOT_READY", message: "Not ready" } }), launch: async () => ({ error: { code: "TASK_NOT_READY", message: "Not ready" } }), setAutoPilot }} onOpenChat={() => undefined} />);

    const control = screen.getByRole("switch", { name: "Auto-pilot" });
    expect(control).toBeChecked();
    await user.click(control);

    expect(setAutoPilot).toHaveBeenCalledWith(false);
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to update auto-pilot.");
    expect(control).toBeChecked();
  });

  it("shows separate planning and execution tabs without hiding unfinished planning", async () => {
    const user = userEvent.setup();
    const executionTasks = dashboardSnapshot.tasks.map((task) => ({ ...task, readiness: { ...task.readiness, phase: "execution" as const, state: task.id === "T0" ? "ready" as const : "blocked" as const } }));
    const snapshot = { ...dashboardSnapshot, taskPasses: { planning: dashboardSnapshot.tasks, execution: executionTasks } };
    render(<FlowchartPage snapshot={snapshot} onOpenChat={() => undefined} />);

    expect(screen.getByRole("tab", { name: "Pass 1 · Planning" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: "Pass 2 · Execution" }));
    expect(screen.getByRole("button", { name: "T0 Graph planning ready" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Pass 2 · Execution" })).toHaveAttribute("aria-selected", "true");
  });

  it("restores the full graph when a live update empties the selected state filter", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<FlowchartPage snapshot={dashboardSnapshot} onOpenChat={() => undefined} />);
    await user.click(screen.getByRole("button", { name: "Show running tasks" }));
    expect(screen.getByRole("button", { name: "T0 Graph planning running" })).toBeVisible();

    const noLongerRunning = { ...dashboardSnapshot, tasks: dashboardSnapshot.tasks.map((task) => ({ ...task, readiness: { ...task.readiness, state: "complete" as const } })) };
    rerender(<FlowchartPage snapshot={noLongerRunning} onOpenChat={() => undefined} />);

    expect(await screen.findByRole("button", { name: "T0 Graph planning complete" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Show all tasks" })).toHaveAttribute("aria-pressed", "true");
  });
  it("provides left-to-right connector handles and arrowheads for dependency edges", () => {
    render(<FlowchartPage snapshot={dashboardSnapshot} onOpenChat={() => undefined} />);

    expect(document.querySelectorAll(".flow-task .react-flow__handle-left.target")).not.toHaveLength(0);
    expect(document.querySelectorAll(".flow-task .react-flow__handle-right.source")).not.toHaveLength(0);
    expect(document.querySelectorAll(".react-flow__edge path[marker-end]")).not.toHaveLength(0);
  });

  it("places dependent tasks in layers to the right of the work that unlocks them", () => {
    const base = dashboardSnapshot.tasks[0];
    const layered = [
      { ...base, id: "F0", pathId: "shared", pathStep: 0, dependsOn: [] },
      { ...base, id: "P1", pathId: "P", pathStep: 1, dependsOn: ["F0"] },
      { ...base, id: "C1", pathId: "C", pathStep: 1, dependsOn: ["F0"] },
      { ...base, id: "P2", pathId: "P", pathStep: 2, dependsOn: ["P1", "C1"] },
    ];
    const positions = taskLayoutPositions(layered);

    expect(positions.get("P1")!.x).toBeGreaterThan(positions.get("F0")!.x);
    expect(positions.get("C1")!.x).toBeGreaterThan(positions.get("F0")!.x);
    expect(positions.get("P2")!.x).toBeGreaterThan(positions.get("P1")!.x);
    expect(positions.get("P2")!.x).toBeGreaterThan(positions.get("C1")!.x);
  });

  it("shows path and layer metadata in the task inspector", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    const layered = {
      ...dashboardSnapshot,
      tasks: dashboardSnapshot.tasks.map((task, index) => ({ ...task, pathId: "P", pathStep: index + 1 })),
    };
    render(<FlowchartPage snapshot={layered} onOpenChat={() => undefined} />);

    await user.click(screen.getByRole("button", { name: "T0 Graph planning running" }));

    expect(screen.getByRole("dialog", { name: "T0 Graph planning" })).toBeVisible();
    expect(screen.getByText("Path: P · Layer: 1")).toBeVisible();
  });

  it("shows every declared artifact path in a UI task inspector", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    const uiTask = {
      ...dashboardSnapshot.tasks[1],
      statusPath: "docs/workers/2026-08-14-mvp3/status/pd.md",
      specificationPath: "docs/superpowers/specs/2026-08-14-mvp3/2026-08-26-p2-people-admin-design.md",
      uiRequirementsPath: "docs/design/requirements/2026-08-26-pd-platform-admin.md",
      uiHandoffPath: "docs/design/handoffs/2026-08-26-pd-platform-admin.md",
    };
    render(<FlowchartPage snapshot={{ ...dashboardSnapshot, tasks: [uiTask] }} onOpenChat={() => undefined} />);

    await user.click(screen.getByRole("button", { name: "U1 Coordinator UI ready" }));

    const inspector = screen.getByRole("dialog", { name: "U1 Coordinator UI" });
    expect(within(inspector).getByRole("heading", { name: "Artifact paths" })).toBeVisible();
    expect(within(inspector).getByText("Status", { selector: "dt" })).toBeVisible();
    expect(within(inspector).getByText("docs/workers/2026-08-14-mvp3/status/pd.md", { selector: "code" })).toBeVisible();
    expect(within(inspector).getByText("Specification", { selector: "dt" })).toBeVisible();
    expect(within(inspector).getByText("docs/superpowers/specs/2026-08-14-mvp3/2026-08-26-p2-people-admin-design.md", { selector: "code" })).toBeVisible();
    expect(within(inspector).getByText("UI requirements", { selector: "dt" })).toBeVisible();
    expect(within(inspector).getByText("docs/design/requirements/2026-08-26-pd-platform-admin.md", { selector: "code" })).toBeVisible();
    expect(within(inspector).getByText("Presentation handoff", { selector: "dt" })).toBeVisible();
    expect(within(inspector).getByText("docs/design/handoffs/2026-08-26-pd-platform-admin.md", { selector: "code" })).toBeVisible();
  });

  it("keeps the graph as the full-page surface and opens task details as an overlay", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    render(<FlowchartPage snapshot={dashboardSnapshot} onOpenChat={() => undefined} />);

    const surface = screen.getByTestId("flowchart-surface");
    expect(surface.parentElement).toHaveClass("flow-layout");
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "T0 Graph planning running" }));

    const dialog = screen.getByRole("dialog", { name: "T0 Graph planning" });
    expect(dialog).toHaveClass("flow-overlay");
    expect(within(dialog).getByRole("button", { name: "Close" })).toHaveClass("overlay-close-button");
  });

  it.each([1440, 768, 390])("renders the same React Flow graph surface at %ipx", (width) => {
    setViewport(width);
    render(<FlowchartPage snapshot={dashboardSnapshot} onOpenChat={() => undefined} />);

    expect(screen.getByTestId("flowchart-surface").querySelector(".react-flow")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Mobile task list" })).not.toBeInTheDocument();
  });

  it("keeps review launch available for blocked, errored, and completed work", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    const snapshot = {
      ...dashboardSnapshot,
      tasks: dashboardSnapshot.tasks.map((task) => task.id === "T0"
        ? { ...task, readiness: { ...task.readiness, state: "complete" as const } }
        : task.id === "U1"
          ? { ...task, readiness: { ...task.readiness, state: "attention_required" as const } }
          : task),
    };
    render(<FlowchartPage snapshot={snapshot} onOpenChat={() => undefined} />);

    for (const [taskLabel, reviewLabel] of [
      ["T0 Graph planning complete", "Review launch for T0"],
      ["U1 Coordinator UI attention_required", "Review launch for U1"],
      ["I0 Integration blocked", "Review launch for I0"],
    ]) {
      await user.click(screen.getByRole("button", { name: taskLabel }));
      expect(screen.getByRole("button", { name: reviewLabel })).toBeEnabled();
      await user.click(screen.getByRole("button", { name: "Close" }));
    }
  });

  it("opens the shared editable launch review from a ready task", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    const previewLaunch = async () => ({ data: { task: dashboardSnapshot.tasks[1], accountId: "bot3", prompt: "UI prompt", dependencies: ["T0"], concurrencyImpact: "1 / 3", accounts: [{ id: "bot3" as const, activeWorkers: 0, available: true }] } });
    render(<FlowchartPage snapshot={dashboardSnapshot} api={{ previewLaunch, launch: async () => ({ data: { id: "d1", clientUserMessageId: "m1", taskId: "U1", accountId: "bot3" as const, threadId: "thread-new", state: "accepted" as const, createdAt: 0, updatedAt: 0, retryAt: null } }) }} onOpenChat={() => undefined} />);

    await user.click(screen.getByRole("button", { name: "U1 Coordinator UI ready" }));
    await user.click(screen.getByRole("button", { name: "Review launch for U1" }));

    expect(await screen.findByRole("dialog", { name: "Launch U1" })).toBeVisible();
    expect(screen.getByLabelText("Worker prompt")).toHaveValue("UI prompt");
  });

  it("opens a mobile node overlay by keyboard, preserves its viewport after Close, and opens the mapped chat", async () => {
    setViewport(390);
    const user = userEvent.setup();
    function Harness() {
      const [openedThread, setOpenedThread] = useState<string | null>(null);
      return <><FlowchartPage snapshot={dashboardSnapshot} initialViewport={{ x: 18, y: -24, zoom: 1.35 }} onOpenChat={setOpenedThread} />{openedThread ? <p>Chats selected: {openedThread}</p> : null}</>;
    }
    render(<Harness />);

    const surface = screen.getByTestId("flowchart-surface");
    const node = screen.getByRole("button", { name: "U1 Coordinator UI ready" });
    node.focus();
    await user.keyboard("{Enter}");

    expect(await screen.findByRole("dialog", { name: "U1 Coordinator UI" })).toBeVisible();
    const viewportBeforeClose = surface.getAttribute("data-viewport");
    expect(viewportBeforeClose).toMatch(/^[-\d.]+,[-\d.]+,[-\d.]+$/);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "U1 Coordinator UI" })).not.toBeInTheDocument();
    expect(surface).toHaveAttribute("data-viewport", viewportBeforeClose);

    node.focus();
    await user.keyboard("{Enter}");
    await user.click(await screen.findByRole("button", { name: "Open chat" }));
    expect(screen.getByText("Chats selected: thread-2")).toBeVisible();
  });

  it("closes a keyboard-opened mobile node overlay with Escape", async () => {
    setViewport(390);
    const user = userEvent.setup();
    render(<FlowchartPage snapshot={dashboardSnapshot} onOpenChat={() => undefined} />);

    const node = screen.getByRole("button", { name: "U1 Coordinator UI ready" });
    node.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("dialog", { name: "U1 Coordinator UI" })).toBeVisible();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "U1 Coordinator UI" })).not.toBeInTheDocument();
    expect(node).toHaveFocus();
  });

  it("keeps Tab focus inside a mobile node overlay", async () => {
    setViewport(390);
    const user = userEvent.setup();
    render(<FlowchartPage snapshot={dashboardSnapshot} onOpenChat={() => undefined} />);

    const node = screen.getByRole("button", { name: "U1 Coordinator UI ready" });
    node.focus();
    await user.keyboard("{Enter}");
    const dialog = await screen.findByRole("dialog", { name: "U1 Coordinator UI" });
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    await user.keyboard("{Tab}");

    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });
});
