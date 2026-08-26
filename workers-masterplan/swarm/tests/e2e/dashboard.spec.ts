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
      await expect(page.getByText("Public access starts at 10:00")).toBeVisible();
      await expect(page.getByText("Suggested account: bot5")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Blocked work" })).toBeVisible();
      await expect(page.getByText("I0 · Integration")).toBeVisible();
      await expect(page.getByText("MASTERPLAN_NOT_READY")).toBeVisible();
      await expect(page.getByRole("button", { name: "Review launch for I0" })).toHaveCount(0);

      await page.getByRole("button", { name: "Flowchart" }).click();
      await expect(page.getByRole("heading", { name: "Flowchart" })).toBeVisible();
      await page.getByRole("button", { name: "Chats" }).click();
      await expect(page.getByRole("heading", { name: "Chats" })).toBeVisible();
      await page.getByRole("button", { name: "Home" }).click();
      await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
    });
  }
});
