import { expect, test, type Page } from "@playwright/test";
import { FIXTURE_CREDENTIALS } from "./fixtureData.js";

async function openChat(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByLabel("Email").fill(FIXTURE_CREDENTIALS.email);
  await page.getByLabel("Password").fill(FIXTURE_CREDENTIALS.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Authentication code").fill("123456");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("link", { name: "Chats", exact: true }).click();
  await page.getByRole("button", { name: "bot3", exact: true }).click();
  await expect(page.getByRole("article", { name: "agentMessage" }).first()).toBeVisible();
}

for (const mode of ["available", "missing", "rejected"] as const) {
  test(`copies exact message source with ${mode} clipboard API`, async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openChat(page);
    if (mode !== "available") await page.evaluate((mode) => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: mode === "missing" ? undefined : { writeText: async () => { throw new Error("Clipboard denied"); } } });
    }, mode);
    const message = page.getByRole("article", { name: "agentMessage" }).first();
    await message.getByRole("button", { name: "Copy message source" }).click();
    await expect(message.getByRole("button", { name: "Message source copied" })).toBeVisible();
    const reader = await context.newPage();
    await reader.goto("/");
    expect(await reader.evaluate(() => navigator.clipboard.readText())).toBe("I found the coordinator runbook.");
    await reader.close();
    await expect(message.getByRole("button", { name: "Copy message source" })).toBeVisible();
  });
}

test("source is monospace and thinking summaries reveal separate content", async ({ page }) => {
  await page.route("**/api/v1/accounts/bot3/threads/thread-1", route => route.fulfill({ json: { data: [
    { id: "source-1", accountId: "bot3", threadId: "thread-1", turnId: "turn-1", type: "agentMessage", status: "completed", createdAt: null, payload: { text: "**Raw** message\n  indentation" } },
    { id: "reason-empty", accountId: "bot3", threadId: "thread-1", turnId: "turn-1", type: "reasoning", status: "completed", createdAt: null, payload: { summary: [" "], content: [] } },
    { id: "reason-full", accountId: "bot3", threadId: "thread-1", turnId: "turn-1", type: "reasoning", status: "completed", createdAt: null, payload: { summary: ["Inspecting the implementation"], content: ["Detailed **reasoning** docs/runbook.md"] } },
  ] } }));
  await openChat(page);
  const message = page.getByRole("article", { name: "agentMessage" });
  await message.getByRole("button", { name: "Show plain text" }).click();
  await expect(message.locator("pre")).toHaveText("**Raw** message\n  indentation");
  expect(await message.locator("pre").evaluate(element => getComputedStyle(element).fontFamily)).toMatch(/mono/i);
  await expect(page.getByRole("button", { name: "Expand Thinking: Thinking...", exact: true })).toBeVisible();
  const reasoning = page.locator('[data-transcript-id="reason-full"]');
  await expect(reasoning.getByRole("link")).toHaveCount(0);
  await reasoning.getByRole("button", { name: "Expand Thinking: Inspecting the implementation" }).click();
  await expect(reasoning.locator("strong")).toHaveText("reasoning");
  await expect(reasoning.getByRole("link", { name: "docs/runbook.md" })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("source-and-thinking-desktop.png") });
});
