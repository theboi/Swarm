import { expect, test, type Page } from "@playwright/test";

import { FIXTURE_CREDENTIALS } from "./fixtureData.js";

async function signIn(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByLabel("Email").fill(FIXTURE_CREDENTIALS.email);
  await page.getByLabel("Password").fill(FIXTURE_CREDENTIALS.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Authentication code").fill("123456");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
}

const viewports = [
  { name: "desktop", width: 1440, height: 900, navigationVariant: "desktop" },
  { name: "tablet", width: 768, height: 1024, navigationVariant: "tablet" },
  { name: "mobile", width: 390, height: 844, navigationVariant: "mobile" },
] as const;

test.describe("Home dashboard", () => {
  for (const viewport of viewports) {
    test(`shows launchable and blocked work on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await signIn(page);

      await expect(page.locator(".app-nav")).toHaveAttribute("data-variant", viewport.navigationVariant);
      await expect(page.getByText(/Public access starts/i)).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Review launch for U1" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Blocked work" })).toBeVisible();
      await expect(page.getByText("I0 · Integration")).toBeVisible();
      await expect(page.getByText("MASTERPLAN_NOT_READY")).toBeVisible();
      await expect(page.getByRole("button", { name: "Review launch for I0" })).toHaveCount(0);

      await page.getByRole("button", { name: "Review launch for U1" }).click();
      const review = page.getByRole("dialog", { name: "Launch U1" });
      await expect(review.getByLabel("Account")).toHaveValue("claudiothe");
      await expect(review.getByRole("option", { name: "claudiothe — 0 workers" })).toBeEnabled();
      await expect(review.getByText("No unarchived chats")).toBeVisible();
      await expect(review.getByLabel("Worker prompt")).toBeEditable();
      await page.keyboard.press("Escape");

      await page.getByRole("button", { name: "Flowchart" }).click();
      await expect(page.getByRole("heading", { name: "Flowchart" })).toBeVisible();
      await page.getByRole("button", { name: "Chats" }).click();
      await expect(page.getByRole("region", { name: "Chats" })).toBeVisible();
      await page.getByRole("button", { name: "Home" }).click();
      await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
    });
  }

  test("summarizes bot usage and opens the full Accounts grid", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);

    await expect(page.locator(".account-summary-row")).toHaveCount(9);
    await expect(page.locator(".account-summary-row").first()).toContainText("claudiothe");
    await expect(page.getByLabel("bot2: five-hour remaining 80%; weekly remaining 20%")).toBeVisible();
    await expect(page.locator(".account-summary-row").filter({ hasText: "bot2" }).locator(".account-summary__weekly")).toHaveAttribute("style", "width: 20%;");
    await expect(page.locator(".account-summary-row").filter({ hasText: "bot2" }).locator(".account-summary__five-hour")).toHaveAttribute("style", "width: 80%;");

    await page.getByRole("button", { name: "View more accounts" }).click();
    await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();
    await expect(page.locator(".accounts-grid .account-card")).toHaveCount(9);
    await expect(page.getByRole("button", { name: "Open terminal for bot1" })).toBeVisible();
    await page.getByRole("button", { name: "Back to home" }).click();
    await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  });
});
