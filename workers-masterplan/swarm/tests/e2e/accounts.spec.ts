import { expect, test, type Page } from "@playwright/test";

import { FIXTURE_CREDENTIALS } from "./fixtureData.js";

async function signIn(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByLabel("Email").fill(FIXTURE_CREDENTIALS.email);
  await page.getByLabel("Password").fill(FIXTURE_CREDENTIALS.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Authentication code").fill("123456");
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("Profile accounts", () => {
  test("orders bot profiles, switches primary, and starts then cancels a fixture-only device challenge", async ({ page }) => {
    await signIn(page);
    await page.getByRole("button", { name: "View more accounts" }).click();

    const accounts = page.locator(".account-bot-group__cards .account-card");
    await expect(accounts).toHaveCount(2);
    await expect(accounts.nth(0)).toContainText("bot1/acc1");
    await expect(accounts.nth(1)).toContainText("bot1/acc2");
    await expect(accounts.nth(0).getByText("Primary")).toBeVisible();

    await page.getByRole("button", { name: "Make Primary for bot1/acc2" }).click();
    await expect(accounts.nth(1).getByText("Primary")).toBeVisible();
    await expect(page.getByRole("button", { name: "Make Primary for bot1/acc1" })).toBeVisible();

    const trigger = page.getByRole("button", { name: "Add account for bot1" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Sign in to bot1/acc3" });
    await expect(dialog).toContainText("FIXTURE-ACC3");
    await expect(dialog.getByRole("link", { name: "Open verification page" })).toHaveAttribute("href", /fixture\.test/);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    const expired = page.getByRole("dialog", { name: "Sign in to bot1/acc4" });
    await expect(expired).toContainText("This sign-in code expired.");
    await expect(expired.getByRole("button", { name: "Copy code" })).toBeDisabled();
  });
});
