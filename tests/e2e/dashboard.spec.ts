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
    test(`shows accounts and attention on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await signIn(page);
      await expect(page.locator(".app-shell")).toHaveCSS("background-color", "rgb(21, 25, 27)");

      await expect(page.locator(".app-nav")).toHaveAttribute("data-variant", viewport.navigationVariant);
      await expect(page.getByText(/Public access starts/i)).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Attention queue" })).toBeVisible();
      await expect(page.getByRole("button", { name: /Review launch/ })).toHaveCount(0);

      await page.getByRole("link", { name: "Todos" }).click();
      await expect(page.getByRole("region", { name: "Todos" })).toBeVisible();
      if (viewport.width < 768) await page.getByRole("button", { name: "More", exact: true }).click();
      await page.getByRole("link", { name: "Chats" }).click();
      await expect(page.getByRole("region", { name: "Chat workspace" })).toBeVisible();
      await page.getByRole("link", { name: "Home" }).click();
      await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
    });
  }

  test("summarizes bot usage and opens the full Accounts grid", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);

    await expect(page.locator(".account-summary-row")).toHaveCount(10);
    await expect(page.locator(".account-summary-row").first()).toContainText("claudiothe");
    await expect(page.getByLabel("bot2: five-hour remaining 80%; weekly remaining 20%")).toBeVisible();
    await expect(page.locator(".account-summary-row").filter({ hasText: "bot2" }).locator(".account-summary__weekly")).toHaveAttribute("style", /width: 20%;/);
    await expect(page.locator(".account-summary-row").filter({ hasText: "bot2" }).locator(".account-summary__five-hour")).toHaveAttribute("style", /width: 80%;/);

    await page.getByRole("button", { name: "View more accounts" }).click();
    await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();
    await expect(page.locator(".accounts-list .account-card")).toHaveCount(10);
    await expect(page.getByRole("button", { name: "Open terminal for bot1/acc1" })).toBeVisible();
    await page.getByRole("button", { name: "Back to home" }).click();
    await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  });
});
