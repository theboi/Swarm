import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppearanceProvider, useAppearance } from "./index";

function Controls() {
  const { theme, setTheme } = useAppearance();
  return <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme}</button>;
}

describe("AppearanceProvider", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    document.documentElement.dataset.theme = "dark";
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it.each([null, "system", "LIGHT"])("defaults to dark for an unsupported saved preference %s", (saved) => {
    if (saved !== null) window.localStorage.setItem("swarm.appearance.v1", saved);
    render(<AppearanceProvider><Controls /></AppearanceProvider>);
    expect(screen.getByRole("button", { name: "dark" }).closest(".radix-themes")).toHaveClass("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("restores light and persists subsequent choices with synchronized document and Radix appearance", () => {
    window.localStorage.setItem("swarm.appearance.v1", "light");
    const view = render(<AppearanceProvider><Controls /></AppearanceProvider>);
    expect(screen.getByRole("button", { name: "light" }).closest(".radix-themes")).toHaveClass("light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    fireEvent.click(screen.getByRole("button", { name: "light" }));
    expect(window.localStorage.getItem("swarm.appearance.v1")).toBe("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(screen.getByRole("button", { name: "dark" }).closest(".radix-themes")).toHaveClass("dark");
    view.unmount();
    render(<AppearanceProvider><Controls /></AppearanceProvider>);
    expect(screen.getByRole("button", { name: "dark" })).toBeVisible();
  });

  it("keeps switching when browser storage cannot be accessed", () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    render(<AppearanceProvider><Controls /></AppearanceProvider>);
    fireEvent.click(screen.getByRole("button", { name: "dark" }));
    expect(screen.getByRole("button", { name: "light" }).closest(".radix-themes")).toHaveClass("light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    fireEvent.click(screen.getByRole("button", { name: "light" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });
});
