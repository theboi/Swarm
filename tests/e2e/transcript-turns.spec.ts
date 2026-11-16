import { expect, test } from "@playwright/test";
import { createFixtureState, FIXTURE_CREDENTIALS } from "./fixtureData.js";

for (const width of [320, 375, 768, 1280]) {
  test(`completed turns retain steers and reopen by keyboard at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const fixture = createFixtureState();
    await page.route("**/api/v1/snapshot", (route) => route.fulfill({ json: { data: fixture.snapshot } }));
    await page.route("**/api/v1/accounts/bot3/threads", (route) => route.fulfill({ json: { data: fixture.snapshot.threads.filter((thread) => thread.accountId === "bot3") } }));
    const item = (id: string, type: string, text: string, phase?: string) => ({ id, type, accountId: "bot3", threadId: "thread-1", turnId: "group-1", turnStatus: "completed", status: "completed", createdAt: null, payload: { text, ...(phase ? { phase } : {}) } });
    const items = [
      item("opening", "userMessage", "Original request"),
      ...Array.from({ length: 120 }, (_, index) => item(`progress-${index}`, "agentMessage", `**Progress ${index}**\n\n${"Checking the implementation. ".repeat(40)}`, "commentary")),
      item("steer", "userMessage", "Keep the final answer short"),
      item("answer", "agentMessage", "Final answer", "final_answer"),
    ];
    await page.route("**/api/v1/accounts/bot3/threads/thread-1", (route) => route.fulfill({ json: { data: items } }));
    await page.goto("/");
    await page.getByLabel("Email").fill(FIXTURE_CREDENTIALS.email);
    await page.getByLabel("Password").fill(FIXTURE_CREDENTIALS.password);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Authentication code").fill("123456");
    await page.getByRole("button", { name: "Sign in" }).click();
    if (width < 768) await page.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("link", { name: "Chats", exact: true }).click();
    await page.getByRole("button", { name: "bot3", exact: true }).click();
    if (width <= 768) await page.getByRole("button", { name: "T0 · Graph planning", exact: true }).click();
    await expect(page.getByText("Final answer", { exact: true })).toBeVisible();
    await expect(page.getByText("Keep the final answer short")).toBeVisible();
    await expect(page.getByText("Original request", { exact: true })).toBeVisible();
    await expect(page.locator(".transcript-item")).toHaveCount(3);
    await expect(page.locator('[data-transcript-id="progress-0"]')).toHaveCount(0);
    const toggle = page.getByRole("button", { name: /Show turn details/ });
    await toggle.scrollIntoViewIfNeeded();
    const box = await toggle.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(28);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    if (width === 375 || width === 1280) await page.screenshot({ path: test.info().outputPath(`collapsed-${width}.png`) });
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Original request", { exact: true })).toBeVisible();
    await expect(page.locator('[data-transcript-id="progress-0"]')).toBeVisible();
    expect(await page.locator(".transcript-item").count()).toBeLessThan(items.length);
    await page.keyboard.press("Space");
    await expect(page.getByText("Original request", { exact: true })).toBeVisible();
    await expect(page.locator(".transcript-item")).toHaveCount(3);
    await expect(page.locator('[data-transcript-id="progress-0"]')).toHaveCount(0);
    const textbox = page.getByRole("textbox", { name: "Message", exact: true });
    await textbox.fill("Typing stays responsive");
    await expect(textbox).toHaveValue("Typing stays responsive");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });
}
