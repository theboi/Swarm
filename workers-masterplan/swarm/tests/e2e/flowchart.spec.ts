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
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
] as const;

test.describe("Flowchart", () => {
  for (const viewport of viewports) {
    test(`filters and zooms the shared graph on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await signIn(page);
      await page.getByRole("button", { name: "Flowchart" }).click();

      const surface = page.getByTestId("flowchart-surface");
      await expect(surface).toBeVisible();
      await expect(page.getByRole("button", { name: "T0 Graph planning running" })).toBeVisible();
      await page.locator(".react-flow__controls-zoomin").click();
      await expect(surface).not.toHaveAttribute("data-viewport", "0,0,1");

      const blockedFilter = page.getByRole("button", { name: "Show blocked tasks" });
      await blockedFilter.click();
      await expect(blockedFilter).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByRole("button", { name: "I0 Integration blocked" })).toBeVisible();
      await expect(page.getByRole("button", { name: "T0 Graph planning running" })).toHaveCount(0);
    });
  }

  test("shows a launch-disabled desktop inspector with readiness evidence", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);
    await page.getByRole("button", { name: "Flowchart" }).click();
    await page.getByRole("button", { name: "Show blocked tasks" }).click();
    await page.getByRole("button", { name: "I0 Integration blocked" }).click();

    await expect(page.getByRole("heading", { name: "I0 Integration" })).toBeVisible();
    await expect(page.getByText("MASTERPLAN_NOT_READY: not satisfied")).toBeVisible();
    await expect(page.getByRole("button", { name: "Launch I0" })).toBeDisabled();
  });

  test("opens a mobile task overlay and hands off to its chat", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);
    await page.getByRole("button", { name: "Flowchart" }).click();
    const task = page.getByRole("button", { name: "T0 Graph planning running" });
    await task.click();

    const inspector = page.getByRole("dialog", { name: "T0 Graph planning" });
    await expect(inspector).toBeVisible();
    await expect(page.getByRole("button", { name: "Launch T0" })).toBeDisabled();
    await page.getByRole("button", { name: "Open chat" }).click();
    await expect(page.getByRole("heading", { name: "Chats" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "T0 · Graph planning" })).toBeVisible();
  });
});
