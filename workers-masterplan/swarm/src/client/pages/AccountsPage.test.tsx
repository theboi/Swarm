import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { dashboardSnapshot } from "../test/fixtures";
import { AccountsPage } from "./AccountsPage";

afterEach(cleanup);

describe("AccountsPage", () => {
  it("keeps sign-in and reconnect actions with the detailed account grid", async () => {
    const user = userEvent.setup();
    const openTerminal = vi.fn(async () => ({ data: {} }));
    const connectAccount = vi.fn(async () => ({ data: {} }));
    const onRefresh = vi.fn(async () => undefined);
    const localFirstSnapshot = {
      ...dashboardSnapshot,
      accounts: [{ id: "claudiothe" as const, connection: "connected" as const, authentication: "authenticated" as const, rateLimits: [], activeTurns: 0, lastAssignedAt: null }, ...dashboardSnapshot.accounts],
    };
    const refreshAllRateLimits = vi.fn(async () => ({ data: {} }));
    render(<AccountsPage snapshot={localFirstSnapshot} api={{ openTerminal, connectAccount, refreshAllRateLimits }} onRefresh={onRefresh} onBack={() => undefined} />);

    expect(screen.getAllByRole("heading", { level: 2 })[0]).toHaveTextContent("claudiothe");
    expect(screen.queryByRole("heading", { name: "Local workspace" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Five-hour remaining: 60%")).toBeVisible();
    const openBotTerminal = screen.getByRole("button", { name: "Open terminal for bot1" });
    expect(openBotTerminal).toHaveClass("account-card__action");
    await user.click(openBotTerminal);
    expect(openTerminal).toHaveBeenCalledWith("bot1");
    expect(screen.getByRole("status")).toHaveTextContent("Sign-in terminal opened for bot1.");

    await user.click(screen.getByRole("button", { name: "Reconnect bot1" }));
    expect(connectAccount).toHaveBeenCalledWith("bot1");
    expect(onRefresh).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent("Account bot1 reconnected.");

    await user.click(screen.getByRole("button", { name: "Refresh usage" }));
    expect(refreshAllRateLimits).toHaveBeenCalledOnce();
  });
});
