import { expect, test, type Page } from "@playwright/test";
import { createFixtureState, FIXTURE_CREDENTIALS } from "./fixtureData.js";

async function signIn(page: Page) {
  const fixture = createFixtureState();
  await page.route("**/api/v1/snapshot", route => route.fulfill({ json: { data: fixture.snapshot } }));
  await page.route("**/api/v1/queued-task-lists", route => route.fulfill({ json: { data: [{ id: "default-work", name: "Work", createdAt: "2026-11-16T00:00:00Z" }] } }));
  await page.route("**/api/v1/queued-tasks?listId=default-work", route => route.fulfill({ json: { data: [] } }));
  await page.goto("/");
  await page.getByLabel("Email").fill(FIXTURE_CREDENTIALS.email);
  await page.getByLabel("Password").fill(FIXTURE_CREDENTIALS.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Authentication code").fill("123456");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("region", { name: "Chat workspace" })).toBeVisible();
}

for (const width of [375, 768, 1440]) {
  test(`Chats is the default and Todos owns the account summary at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);
    await expect(page).toHaveTitle("Swarm");
    await expect(page).toHaveURL(/\/chats$/);
    const nav = page.getByRole("navigation", { name: "Primary navigation" });
    expect(await nav.getByRole("link").evaluateAll(links => links.slice(0, 3).map(link => link.getAttribute("aria-label")))).toEqual(["Chats", "Todos", "Accounts"]);
    await expect(nav.getByRole("link", { name: "Home", exact: true })).toHaveCount(0);
    await page.getByRole("link", { name: "Todos", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Work", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/todos\?list=default-work$/);
    const summary = page.getByRole("complementary", { name: "Accounts", exact: true });
    await expect(summary.locator(".account-summary-row")).toHaveCount(10);
    if (width >= 1180) {
      const pageBox = await page.getByRole("region", { name: "Todos" }).boundingBox();
      const summaryBox = await summary.boundingBox();
      expect(summaryBox!.x).toBeGreaterThanOrEqual(pageBox!.x + pageBox!.width);
    }
    if (width < 768) await page.getByRole("button", { name: "Lists", exact: true }).click();
    const create = page.getByRole("button", { name: "Create List", exact: true });
    await expect(create).toHaveClass(/appearance-primary/);
    const fit = await create.evaluate(element => Math.abs(element.getBoundingClientRect().width - element.parentElement!.getBoundingClientRect().width));
    expect(fit).toBeLessThan(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`todos-accounts-${width}.png`), fullPage: true });
    await summary.getByRole("button", { name: "Open chats for bot3" }).click();
    await expect(page.getByRole("tab", { name: "bot3", exact: true })).toHaveAttribute("aria-selected", "true");
  });
}

test("Todos account summary opens the full Accounts grid and returns to Todos", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.getByRole("link", { name: "Todos", exact: true }).click();
  const summary = page.getByRole("complementary", { name: "Accounts", exact: true });
  await expect(summary.getByLabel("bot2: five-hour remaining 80%; weekly remaining 20%")).toBeVisible();
  await summary.getByRole("button", { name: "View more accounts" }).click();
  await expect(page.getByRole("heading", { name: "Accounts", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open terminal for bot1/acc1" })).toBeVisible();
  await page.getByRole("button", { name: "Back to Todos" }).click();
  await expect(page.getByRole("region", { name: "Todos" })).toBeVisible();
});
