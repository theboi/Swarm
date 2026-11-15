import { cleanup, screen } from "@testing-library/react";
import { renderWithOverlays as render } from "../test/renderWithOverlays";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { dashboardSnapshot, profileDashboardSnapshot } from "../test/fixtures";
import { AccountsPage } from "./AccountsPage";

afterEach(cleanup);

describe("AccountsPage", () => {
  it("keeps each bot profile in account-number order and switches the exclusive primary state", async () => {
    const user = userEvent.setup();
    const makePrimary = vi.fn(async () => ({ data: [
      { id: "bot1/acc1" as const, macosUser: "bot1" as const, accountNumber: 1, isPrimary: false, connection: "connected" as const, authentication: "authenticated" as const, rateLimits: [], activeTurns: 0, lastAssignedAt: null },
      { id: "bot1/acc2" as const, macosUser: "bot1" as const, accountNumber: 2, isPrimary: true, connection: "connected" as const, authentication: "authenticated" as const, rateLimits: [], activeTurns: 0, lastAssignedAt: null },
    ] }));
    const profileSnapshot = { ...profileDashboardSnapshot, accounts: [...profileDashboardSnapshot.accounts].reverse() };
    render(<AccountsPage snapshot={profileSnapshot} api={{ openTerminal: vi.fn(async () => ({ data: {} })), connectAccount: vi.fn(async () => ({ data: {} })), refreshAllRateLimits: vi.fn(async () => ({ data: {} })), makePrimary, addAccount: vi.fn(async () => ({ data: profileSnapshot.accounts[0] })), startAccountLogin: vi.fn(async () => ({ data: { accountId: "bot1/acc2" as const, method: "device_code" as const, verificationUrl: "https://auth.example.test", userCode: "ABCD-EFGH", expiresAt: Date.now() + 60_000 } })), cancelAccountLogin: vi.fn(async () => ({ data: {} })) }} onRefresh={vi.fn(async () => undefined)} onBack={() => undefined} />);

    const cards = screen.getAllByRole("article");
    expect(cards.map((card) => card.textContent)).toEqual(expect.arrayContaining([expect.stringContaining("bot1/acc1"), expect.stringContaining("bot1/acc2")]));
    const acc1 = cards.find((card) => card.textContent?.includes("bot1/acc1"));
    const acc2 = cards.find((card) => card.textContent?.includes("bot1/acc2"));
    expect(acc1).toBeDefined();
    expect(acc2).toBeDefined();
    expect(acc1!.compareDocumentPosition(acc2!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Primary")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Make Primary for bot1/acc2" }));

    expect(makePrimary).toHaveBeenCalledWith("bot1/acc2");
    expect(screen.getAllByText("Primary")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Make Primary for bot1/acc2" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Make Primary for bot1/acc1" })).toBeVisible();
  });

  it("adds the next bot profile and opens its device sign-in dialog", async () => {
    const user = userEvent.setup();
    const addAccount = vi.fn(async () => ({ data: { id: "bot1/acc2" as const, macosUser: "bot1" as const, accountNumber: 2, isPrimary: false, connection: "action_required" as const, authentication: "unauthenticated" as const, rateLimits: [], activeTurns: 0, lastAssignedAt: null } }));
    const startAccountLogin = vi.fn(async () => ({ data: { accountId: "bot1/acc2" as const, method: "device_code" as const, verificationUrl: "https://auth.example.test", userCode: "ABCD-EFGH", expiresAt: Date.now() + 60_000 } }));
    render(<AccountsPage snapshot={{ ...dashboardSnapshot, accounts: [{ id: "bot1/acc1" as const, macosUser: "bot1" as const, accountNumber: 1, isPrimary: true, connection: "connected" as const, authentication: "authenticated" as const, rateLimits: [], activeTurns: 0, lastAssignedAt: null }] }} api={{ openTerminal: vi.fn(async () => ({ data: {} })), connectAccount: vi.fn(async () => ({ data: {} })), refreshAllRateLimits: vi.fn(async () => ({ data: {} })), makePrimary: vi.fn(async () => ({ data: [] })), addAccount, startAccountLogin, cancelAccountLogin: vi.fn(async () => ({ data: {} })) }} onRefresh={vi.fn(async () => undefined)} onBack={() => undefined} />);

    await user.click(screen.getByRole("button", { name: "Add account for bot1" }));

    expect(addAccount).toHaveBeenCalledWith("bot1");
    expect(startAccountLogin).toHaveBeenCalledWith("bot1/acc2", "device_code");
    expect(await screen.findByRole("dialog", { name: "Sign in to bot1/acc2" })).toHaveTextContent("ABCD-EFGH");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Login to bot1/acc2" })).toBeVisible();
  });

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
    render(<AccountsPage snapshot={localFirstSnapshot} api={{ openTerminal, connectAccount, refreshAllRateLimits, makePrimary: vi.fn(async () => ({ data: [] })), addAccount: vi.fn(async () => ({ data: localFirstSnapshot.accounts[0] })), startAccountLogin: vi.fn(async () => ({ data: { accountId: "bot1/acc2" as const, method: "device_code" as const, verificationUrl: "https://auth.example.test", expiresAt: Date.now() + 60_000 } })), cancelAccountLogin: vi.fn(async () => ({ data: {} })) }} onRefresh={onRefresh} onBack={() => undefined} />);

    expect(screen.getAllByRole("heading", { level: 2 })[0]).toHaveTextContent("claudiothe");
    expect(screen.queryByRole("heading", { name: "Local workspace" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Five-hour remaining: 60%")).toBeVisible();
    const openBotTerminal = screen.getByRole("button", { name: "Open terminal for bot1" });
    expect(openBotTerminal).toHaveClass("account-card__action");
    await user.click(openBotTerminal);
    expect(openTerminal).toHaveBeenCalledWith("bot1");
    expect(await screen.findByText("Sign-in terminal opened for bot1.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Reconnect bot1" }));
    expect(connectAccount).toHaveBeenCalledWith("bot1");
    expect(onRefresh).toHaveBeenCalledOnce();
    expect(await screen.findByText("Account bot1 reconnected.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Refresh usage" }));
    expect(refreshAllRateLimits).toHaveBeenCalledOnce();
  });

  it("shows an identity collision on the affected profile card", () => {
    const accounts = profileDashboardSnapshot.accounts.map((account) => account.id === "bot1/acc2"
      ? { ...account, connection: "action_required" as const, authentication: "unauthenticated" as const, errorCode: "IDENTITY_ALREADY_CONNECTED" }
      : account);
    render(<AccountsPage snapshot={{ ...profileDashboardSnapshot, accounts }} api={{ openTerminal: vi.fn(async () => ({ data: {} })), connectAccount: vi.fn(async () => ({ data: {} })), refreshAllRateLimits: vi.fn(async () => ({ data: {} })), makePrimary: vi.fn(async () => ({ data: [] })), addAccount: vi.fn(async () => ({ data: accounts[0]! })), startAccountLogin: vi.fn(async () => ({ data: { accountId: "bot1/acc2" as const, method: "device_code" as const, verificationUrl: "https://auth.example.test", expiresAt: Date.now() + 60_000 } })), cancelAccountLogin: vi.fn(async () => ({ data: {} })) }} onRefresh={vi.fn(async () => undefined)} onBack={() => undefined} />);

    expect(screen.getByText("That ChatGPT identity is already connected to another profile.")).toBeVisible();
  });
});
