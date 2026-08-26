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

async function setFixtureNgrok(page: Page, input: { state: "stopped" | "running" | "error" | "disabled"; publicUrl?: string | null; message?: string | null }): Promise<void> {
  const status = await page.evaluate(async (body) => (await fetch("/api/v1/fixture/ngrok", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })).status, input);
  expect(status).toBe(200);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
}

test.describe("ngrok daily window", () => {
  test.describe.configure({ mode: "serial" });

  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "mobile", width: 390, height: 844 },
  ] as const) {
    test(`shows the next public-access window on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await signIn(page);
      await expect(page.getByText("Public access starts at 10:00")).toBeVisible();
      await expect(page.getByRole("link", { name: /ngrok/i })).toHaveCount(0);
    });
  }

  test("renders active, failed, and disabled tunnel state without real ngrok", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);

    await setFixtureNgrok(page, { state: "running", publicUrl: "https://fixture.ngrok.app" });
    await expect(page.getByText("Public until 00:00")).toBeVisible();
    await expect(page.getByRole("link", { name: "https://fixture.ngrok.app" })).toHaveAttribute("href", "https://fixture.ngrok.app");

    await setFixtureNgrok(page, { state: "error", message: "Fixture tunnel unavailable" });
    await expect(page.getByText("Fixture tunnel unavailable")).toBeVisible();
    await expect(page.getByRole("link", { name: /ngrok/i })).toHaveCount(0);

    await setFixtureNgrok(page, { state: "disabled" });
    await expect(page.getByText("Public access is disabled.")).toBeVisible();

    await setFixtureNgrok(page, { state: "stopped" });
    await expect(page.getByText("Public access starts at 10:00")).toBeVisible();
  });
});
