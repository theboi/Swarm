import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AppShell } from "./AppShell";
import { setViewport } from "../test/fixtures";

afterEach(cleanup);

describe("AppShell", () => {
  it("uses an icon-only desktop rail with accessible 44px navigation controls", () => {
    setViewport(1440);
    render(<AppShell activePage="home" onNavigate={() => undefined}><p>Content</p></AppShell>);

    const navigation = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(navigation).toHaveAttribute("data-variant", "desktop");
    for (const label of ["Home", "Accounts", "Flowchart", "Chats"]) {
      const control = screen.getByRole("link", { name: label });
      expect(getComputedStyle(control).minWidth).toBe("44px");
      expect(getComputedStyle(control).minHeight).toBe("44px");
      expect(control).toHaveAttribute("title", label);
      expect(control).toHaveTextContent("");
    }
  });

  it("switches to an icon rail at exactly 768px while preserving accessible labels", () => {
    setViewport(768);
    render(<AppShell activePage="home" onNavigate={() => undefined}><p>Content</p></AppShell>);

    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toHaveAttribute("data-variant", "tablet");
    expect(screen.getByRole("link", { name: "Home" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Accounts" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Flowchart" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Chats" })).toBeVisible();
  });

  it("uses fixed bottom navigation on mobile", () => {
    setViewport(390);
    render(<AppShell activePage="home" onNavigate={() => undefined}><p>Content</p></AppShell>);

    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toHaveAttribute("data-variant", "mobile");
  });

  it("marks Accounts as the current primary destination", () => {
    setViewport(1440);
    render(<AppShell activePage="accounts" onNavigate={() => undefined}><p>Content</p></AppShell>);

    expect(screen.getByRole("link", { name: "Accounts" })).toHaveAttribute("aria-current", "page");
  });

  it("adds a Chats notification dot when a breaking change needs attention", () => {
    setViewport(1440);
    render(<AppShell activePage="home" hasBreakingChangeNotification onNavigate={() => undefined}><p>Content</p></AppShell>);

    expect(screen.getByRole("link", { name: "Chats — breaking change notification" })).toBeVisible();
    expect(screen.getByLabelText("Breaking change notification")).toBeVisible();
  });
});
