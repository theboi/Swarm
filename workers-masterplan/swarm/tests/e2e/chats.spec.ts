import { expect, test, type Page } from "@playwright/test";

import { FIXTURE_CREDENTIALS } from "./fixtureData.js";

async function signIn(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByLabel("Email").fill(FIXTURE_CREDENTIALS.email);
  await page.getByLabel("Password").fill(FIXTURE_CREDENTIALS.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Authentication code").fill("123456");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("button", { name: "Chats" }).click();
  await expect(page.getByRole("heading", { name: "Chats" })).toBeVisible();
}

async function selectBot3Thread(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "bot3" }).click();
  await page.getByRole("button", { name }).click();
}

test.describe("Chats", () => {
  test.describe.configure({ mode: "serial" });

  test("reveals bot3 chats only after its compact picker is re-clicked", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);

    const bot3 = page.getByRole("button", { name: "bot3" });
    await bot3.click();
    await expect(bot3).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "T0 · Graph planning" })).toHaveCount(0);
    await bot3.click();
    await expect(page.getByRole("button", { name: "T0 · Graph planning" })).toBeVisible();
    await bot3.click();
    await expect(page.getByRole("button", { name: "T0 · Graph planning" })).toHaveCount(0);
  });

  test("shows normalized transcript details, approved controls, and capability gating", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);
    await selectBot3Thread(page, "T0 · Graph planning");

    const transcript = page.getByTestId("transcript-scroll");
    const command = transcript.getByRole("article", { name: "commandExecution" });
    await expect(command.locator("pre").nth(0)).toHaveText("git status --short");
    await expect(command.locator("pre").nth(1)).toHaveText(" M workers-masterplan/swarm/src/client/App.tsx\n");
    await transcript.evaluate((element) => { element.scrollTop = 72; });
    await page.getByRole("link", { name: "docs/runbook.md" }).click();
    const viewer = page.getByRole("dialog", { name: "runbook.md" });
    await expect(viewer).toBeVisible();
    await expect(viewer.locator("script")).toHaveCount(0);
    await expect(viewer.getByRole("heading", { name: "Runbook", exact: true })).toBeVisible();
    await viewer.getByRole("button", { name: "Close" }).click();
    await expect(viewer).toHaveCount(0);
    await expect.poll(() => transcript.evaluate((element) => element.scrollTop)).toBe(72);

    for (const name of ["Send", "Archive chat", "Steer", "Interrupt"]) await expect(page.getByRole("button", { name })).toBeEnabled();
    const targetSizes = await page.locator(".chat-panel button:visible").evaluateAll((buttons) => buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return { width: box.width, height: box.height };
    }));
    expect(targetSizes.every(({ width, height }) => width >= 44 && height >= 44)).toBe(true);

    await page.getByRole("button", { name: "Decline approval" }).click();
    await expect(page.getByRole("status")).toHaveText("Approval response sent.");
    await page.getByLabel("Message", { exact: true }).fill("Fixture operator message");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByRole("status")).toHaveText("Message sent.");
    await page.getByRole("button", { name: "Steer" }).click();
    await expect(page.getByRole("status")).toHaveText("Turn steered.");
    await page.getByRole("button", { name: "Interrupt" }).click();
    await expect(page.getByRole("status")).toHaveText("Turn interrupted.");

    await page.getByRole("button", { name: "U1 · Coordinator UI" }).click();
    for (const name of ["Send", "Archive chat", "Steer", "Interrupt"]) await expect(page.getByRole("button", { name })).toBeDisabled();

    await page.getByRole("button", { name: "T0 · Graph planning" }).click();
    await page.getByRole("button", { name: "Archive chat" }).click();
    await expect(page.getByRole("status")).toHaveText("Chat archived.");
    await page.getByRole("button", { name: "New chat" }).click();
    await expect(page.getByRole("status")).toHaveText("New chat created.");
  });
});
