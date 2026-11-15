import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AppearanceProvider } from "../../components/AppearanceProvider";
import { AppearanceSettings } from "./index";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("offers only appearance navigation and switches the selected color theme", () => {
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
  render(<AppearanceProvider><AppearanceSettings onNavigate={() => {}} /></AppearanceProvider>);
  const navigation = screen.getByRole("navigation", { name: "Settings sections" });
  expect(within(navigation).getAllByRole("link")).toHaveLength(1);
  expect(within(navigation).getByRole("link", { name: "Appearance" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Light" }));
  expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "false");
  expect(document.documentElement).toHaveAttribute("data-theme", "light");
});
