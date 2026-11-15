import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "./AppShell";
import { setViewport } from "../test/fixtures";

afterEach(cleanup);

describe("AppShell", () => {
  it("hides mobile navigation while a chat composer is focused and restores it on blur", () => {
    setViewport(390);
    render(<AppShell activePage="chats" onNavigate={() => undefined}><textarea aria-label="Message" /></AppShell>);
    fireEvent.focus(screen.getByRole("textbox", { name: "Message" }));
    expect(screen.queryByRole("navigation", { name: "Primary navigation" })).not.toBeInTheDocument();
    fireEvent.blur(screen.getByRole("textbox", { name: "Message" }));
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  });

  it("uses an icon-only desktop rail with accessible 44px navigation controls", () => {
    setViewport(1440);
    render(<AppShell activePage="home" onNavigate={() => undefined}><p>Content</p></AppShell>);

    const navigation = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(navigation).toHaveAttribute("data-variant", "desktop");
    for (const label of ["Home", "Accounts", "Todos", "Chats", "Settings"]) {
      const control = screen.getByRole("link", { name: label });
      expect(getComputedStyle(control).minWidth).toBe("44px");
      expect(getComputedStyle(control).minHeight).toBe("44px");
      expect(control).toHaveAttribute("title", label);
      expect(control.textContent).toBe("");
    }
  });

  it("switches to an icon rail at exactly 768px while preserving accessible labels", () => {
    setViewport(768);
    render(<AppShell activePage="home" onNavigate={() => undefined}><p>Content</p></AppShell>);

    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toHaveAttribute("data-variant", "tablet");
    expect(screen.getByRole("link", { name: "Home" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Accounts" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Todos" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Chats" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Home" }).textContent).toBe("");
  });

  it("uses fixed bottom navigation on mobile", () => {
    setViewport(390);
    render(<AppShell activePage="home" onNavigate={() => undefined}><p>Content</p></AppShell>);

    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toHaveAttribute("data-variant", "mobile");
    expect(screen.getByRole("link", { name: "Home" })).toHaveTextContent("Home");
    expect(screen.getByRole("link", { name: "Accounts" })).toHaveTextContent("Accounts");
    expect(screen.getByRole("link", { name: "Todos" })).toHaveTextContent("Todos");
    expect(screen.queryByRole("link", { name: "Chats" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    expect(screen.getByRole("link", { name: "Chats" })).toHaveTextContent("Chats");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings/appearance");
  });

  it("uses an icon-only tablet rail through 1279px", () => {
    setViewport(1024);
    render(<AppShell activePage="home" onNavigate={() => undefined}><p>Content</p></AppShell>);
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toHaveAttribute("data-variant", "tablet");
    expect(screen.getByRole("link", { name: "Settings" }).textContent).toBe("");
  });

  it("closes More with Escape and returns focus to its trigger", () => {
    setViewport(390);
    render(<AppShell activePage="home" onNavigate={() => undefined}><p>Content</p></AppShell>);
    const trigger = screen.getByRole("button", { name: "More" });
    fireEvent.click(trigger);
    screen.getByRole("link", { name: "Chats" }).focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole("link", { name: "Chats" })).not.toBeInTheDocument();
  });

  it("lets keyboard users tab from More into its destinations and dismiss outside", async () => {
    setViewport(390);
    const user = userEvent.setup();
    render(<AppShell activePage="home" onNavigate={() => undefined}><p>Content</p></AppShell>);
    const trigger = screen.getByRole("button", { name: "More" });
    trigger.focus();
    await user.keyboard("{Enter}{Tab}");
    expect(screen.getByRole("link", { name: "Chats" })).toHaveFocus();
    await user.click(screen.getByText("Content"));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("dismisses More after choosing a destination and preserves modified native links", () => {
    setViewport(390);
    const navigate = vi.fn();
    render(<AppShell activePage="home" onNavigate={navigate}><p>Content</p></AppShell>);
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    const modifiedClick = new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true });
    // Observe native-link behavior, then cancel only JSDOM's unavailable navigation.
    document.addEventListener("click", (event) => {
      expect(event.defaultPrevented).toBe(false);
      event.preventDefault();
    }, { once: true });
    fireEvent(screen.getByRole("link", { name: "Chats" }), modifiedClick);
    expect(navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("link", { name: "Settings" }));
    expect(navigate).toHaveBeenCalledWith("settings");
    expect(screen.getByRole("button", { name: "More" })).toHaveAttribute("aria-expanded", "false");
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
