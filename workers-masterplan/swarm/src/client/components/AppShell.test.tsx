import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AppShell } from "./AppShell";
import { setViewport } from "../test/fixtures";

afterEach(cleanup);

describe("AppShell", () => {
  it("uses a labeled desktop rail with 44px navigation controls", () => {
    setViewport(1440);
    render(<AppShell activePage="home" onNavigate={() => undefined}><p>Content</p></AppShell>);

    const navigation = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(navigation).toHaveAttribute("data-variant", "desktop");
    for (const label of ["Home", "Flowchart", "Chats"]) {
      const control = screen.getByRole("button", { name: label });
      expect(getComputedStyle(control).minWidth).toBe("44px");
      expect(getComputedStyle(control).minHeight).toBe("44px");
    }
  });

  it("switches to an icon rail at exactly 768px while preserving accessible labels", () => {
    setViewport(768);
    render(<AppShell activePage="home" onNavigate={() => undefined}><p>Content</p></AppShell>);

    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toHaveAttribute("data-variant", "tablet");
    expect(screen.getByRole("button", { name: "Home" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Flowchart" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Chats" })).toBeVisible();
  });

  it("uses fixed bottom navigation on mobile", () => {
    setViewport(390);
    render(<AppShell activePage="home" onNavigate={() => undefined}><p>Content</p></AppShell>);

    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toHaveAttribute("data-variant", "mobile");
  });
});
