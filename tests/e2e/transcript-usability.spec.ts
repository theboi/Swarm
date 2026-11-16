import { expect, test, type Page } from "@playwright/test";
import { createFixtureState, FIXTURE_CREDENTIALS } from "./fixtureData.js";
import type { TranscriptItem } from "../../src/shared/contracts.js";

async function openChat(page: Page, items?: TranscriptItem[], width = 1440) {
  const fixture = createFixtureState();
  // Other journeys archive chats; this read-only view must not depend on their state.
  await page.route("**/api/v1/snapshot", route => route.fulfill({ json: { data: fixture.snapshot } }));
  await page.route("**/api/v1/accounts/bot3/threads", route => route.fulfill({ json: { data: fixture.snapshot.threads.filter(thread => thread.accountId === "bot3") } }));
  await page.route("**/api/v1/accounts/bot3/threads/thread-1", route => route.fulfill({ json: { data: items ?? fixture.transcripts.get("bot3:thread-1") } }));
  await page.setViewportSize({ width, height: 1000 });
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
  await expect(page.getByRole("article", { name: "agentMessage" }).first()).toBeVisible();
}

for (const [width, theme] of [[375, "dark"], [375, "light"], [1280, "dark"], [1280, "light"]] as const) {
  test(`user cards are green and centred and New chat fills its panel at ${width}px in ${theme}`, async ({ page }) => {
    await page.addInitScript(theme => localStorage.setItem("swarm.appearance.v1", theme), theme);
    await openChat(page, undefined, width);
    const user = page.getByRole("article", { name: "userMessage" }).first();
    await user.scrollIntoViewIfNeeded();
    await expect(user).toHaveAttribute("data-card-radius", "lg");
    const style = await user.evaluate(element => {
      const box = element.getBoundingClientRect();
      const parent = element.parentElement!.getBoundingClientRect();
      return { background: getComputedStyle(element).backgroundColor, centreOffset: Math.abs(box.x + box.width / 2 - parent.x - parent.width / 2) };
    });
    expect(style.centreOffset).toBeLessThan(1);
    const channels = style.background.match(/\d+/g)!.map(Number);
    expect(channels[1]).toBeGreaterThan(channels[0]);
    await page.screenshot({ path: test.info().outputPath(`green-user-${theme}-${width}.png`) });
    if (width <= 768) await page.getByRole("button", { name: "Back to chats" }).click();
    const newChat = page.getByRole("button", { name: "New chat", exact: true });
    const dimensions = await newChat.evaluate(element => {
      const parent = element.parentElement!;
      const style = getComputedStyle(parent);
      return { button: element.getBoundingClientRect().width, available: parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) };
    });
    expect(Math.abs(dimensions.button - dimensions.available)).toBeLessThan(1);
  });
}

test("history loads automatically in both directions and offloads distant Markdown", async ({ page }) => {
  const items: TranscriptItem[] = Array.from({ length: 300 }, (_, index) => ({ id: `lazy-${index}`, accountId: "bot3", threadId: "thread-1", turnId: "live-turn", type: "agentMessage", status: "completed", createdAt: null, payload: { text: `History entry ${index}\n\n${"Long message content. ".repeat(12)}` } }));
  await openChat(page, items);
  const scroll = page.getByTestId("transcript-scroll");
  await expect(page.getByRole("button", { name: "Show earlier messages" })).toHaveCount(0);
  await expect(page.locator('[data-transcript-id="lazy-299"]')).toBeInViewport();
  await expect(page.locator('[data-transcript-id="lazy-0"]')).toHaveCount(0);
  await scroll.hover();
  await page.mouse.wheel(0, -100000);
  const oldest = page.locator('[data-transcript-id="lazy-0"]');
  await expect(oldest).toBeInViewport();
  await expect(page.locator('[data-transcript-id="lazy-299"]')).toHaveCount(0);
  expect(await page.locator(".transcript-item").count()).toBeLessThan(125);
  await oldest.getByRole("button", { name: "Show plain text" }).click();
  await page.getByRole("button", { name: "Scroll to bottom", exact: true }).click();
  await expect(page.locator('[data-transcript-id="lazy-299"]')).toBeInViewport();
  await expect(page.locator('[data-transcript-id="lazy-0"]')).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("lazy-history-bottom.png") });
  await scroll.hover();
  await page.mouse.wheel(0, -100000);
  await expect(oldest).toBeInViewport();
  await expect(oldest.locator("pre")).toContainText("History entry 0");
  await expect.poll(() => scroll.evaluate(element => element.scrollTop)).toBeLessThan(10);
});

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
  await openChat(page, [
    { id: "source-1", accountId: "bot3", threadId: "thread-1", turnId: "turn-1", type: "agentMessage", status: "completed", createdAt: null, payload: { text: "**Raw** message\n  indentation" } },
    { id: "reason-empty", accountId: "bot3", threadId: "thread-1", turnId: "turn-1", type: "reasoning", status: "completed", createdAt: null, payload: { summary: [" "], content: [] } },
    { id: "reason-full", accountId: "bot3", threadId: "thread-1", turnId: "turn-1", type: "reasoning", status: "completed", createdAt: null, payload: { summary: ["Inspecting the implementation"], content: ["Detailed **reasoning** docs/runbook.md"] } },
  ]);
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
