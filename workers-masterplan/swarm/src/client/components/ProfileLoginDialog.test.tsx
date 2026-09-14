import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BotProfileAccountId } from "../../shared/contracts";
import { ProfileLoginDialog } from "./ProfileLoginDialog";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ProfileLoginDialog", () => {
  it("offers accessible device-code controls and cancels with Escape", async () => {
    const user = userEvent.setup();
    const cancel = vi.fn(async () => ({ data: {} }));
    const close = vi.fn();
    const trigger = document.createElement("button");
    trigger.textContent = "Add account for bot1";
    document.body.append(trigger);
    trigger.focus();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(<ProfileLoginDialog accountId="bot1/acc2" challenge={{ accountId: "bot1/acc2", method: "device_code", verificationUrl: "https://auth.example.test", userCode: "ABCD-EFGH", expiresAt: Date.now() + 60_000 }} onStart={vi.fn(async () => ({ data: { accountId: "bot1/acc2" as const, method: "device_code" as const, verificationUrl: "https://auth.example.test", userCode: "ABCD-EFGH", expiresAt: Date.now() + 60_000 } }))} onCancel={cancel} onClose={close} onRestoreFocus={() => trigger.focus()} />);

    const dialog = screen.getByRole("dialog", { name: "Sign in to bot1/acc2" });
    expect(dialog).toHaveTextContent("ABCD-EFGH");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(screen.getByRole("link", { name: "Open verification page" })).toHaveAttribute("href", "https://auth.example.test");
    await user.click(screen.getByRole("button", { name: "Copy code" }));
    expect(writeText).toHaveBeenCalledWith("ABCD-EFGH");
    await user.keyboard("{Escape}");
    expect(cancel).toHaveBeenCalledWith("bot1/acc2");
    expect(close).toHaveBeenCalledOnce();
    trigger.remove();
  });

  it("disables expired codes and supports browser sign-in and retry", async () => {
    const user = userEvent.setup();
    const start = vi.fn(async (_accountId: BotProfileAccountId, method: "device_code" | "same_mac_browser") => ({ data: { accountId: "bot1/acc2" as const, method, verificationUrl: "https://auth.example.test/browser", expiresAt: Date.now() + 60_000 } }));
    render(<ProfileLoginDialog accountId="bot1/acc2" challenge={{ accountId: "bot1/acc2", method: "device_code", verificationUrl: "https://auth.example.test", userCode: "EXPIRED", expiresAt: Date.now() - 1 }} onStart={start} onCancel={vi.fn(async () => ({ data: {} }))} onClose={() => undefined} onRestoreFocus={() => undefined} />);

    expect(screen.getByRole("button", { name: "Copy code" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(start).toHaveBeenCalledWith("bot1/acc2", "device_code");
    await user.click(screen.getByRole("button", { name: "Use browser sign-in" }));
    expect(start).toHaveBeenCalledWith("bot1/acc2", "same_mac_browser");
  });
});
