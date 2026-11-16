import { expect, test } from "@playwright/test";

import { FIXTURE_CREDENTIALS } from "./fixtureData.js";

test("signs in through the fixture-only password and TOTP flow", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByLabel("Email").fill(FIXTURE_CREDENTIALS.email);
  await page.getByLabel("Password").fill(FIXTURE_CREDENTIALS.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Authentication code").fill("123456");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("region", { name: "Chat workspace" })).toBeVisible();
});
