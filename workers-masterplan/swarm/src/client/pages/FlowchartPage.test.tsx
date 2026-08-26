import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { FlowchartPage } from "./FlowchartPage";
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
  it.each([1440, 768, 390])("renders the same React Flow graph surface at %ipx", (width) => {
    setViewport(width);
    render(<FlowchartPage snapshot={dashboardSnapshot} onOpenChat={() => undefined} />);

    expect(screen.getByTestId("flowchart-surface").querySelector(".react-flow")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Mobile task list" })).not.toBeInTheDocument();
  });

  it("filters visible node states and keeps a blocked task unavailable for launch", async () => {
    setViewport(1440);
    const user = userEvent.setup();
    render(<FlowchartPage snapshot={dashboardSnapshot} onOpenChat={() => undefined} />);

    await user.click(screen.getByRole("button", { name: "Show blocked tasks" }));

    expect(screen.getByRole("button", { name: "I0 Integration blocked" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "U1 Coordinator UI ready" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "I0 Integration blocked" }));
    expect(screen.getByRole("button", { name: "Launch I0" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Show all tasks" }));
    await user.click(screen.getByRole("button", { name: "U1 Coordinator UI ready" }));
    expect(screen.getByRole("button", { name: "Launch U1" })).toBeDisabled();
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
