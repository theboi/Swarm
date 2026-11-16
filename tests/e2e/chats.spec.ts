import { expect, test, type Page } from "@playwright/test";

import { FIXTURE_CREDENTIALS } from "./fixtureData.js";
import type { ThreadSummary } from "../../src/shared/contracts.js";

async function signIn(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByLabel("Email").fill(FIXTURE_CREDENTIALS.email);
  await page.getByLabel("Password").fill(FIXTURE_CREDENTIALS.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Authentication code").fill("123456");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("link", { name: "Chats", exact: true }).click();
  await expect(page.getByRole("region", { name: "Chat workspace" })).toBeVisible();
}

async function selectBot3Thread(page: Page, name: string): Promise<void> {
  const account = page.getByRole("tab", { name: "bot3" });
  const compact = (page.viewportSize()?.width ?? 1440) <= 768;
  if (compact || await account.getAttribute("aria-selected") !== "true") await account.click();
  const thread = page.getByRole("button", { name });
  await expect(thread).toHaveAttribute("aria-pressed", compact ? "false" : "true");
  if (compact) await thread.click();
}

test.describe("Chats", () => {
  test.describe.configure({ mode: "serial" });

  for (const width of [390, 768, 1440]) {
    test(`contains long chat lists inside the viewport at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 720 });
      await page.route("**/api/v1/accounts/bot3/threads", async route => {
        const response = await route.fetch();
        const body = await response.json() as { data: ThreadSummary[] };
        const template = body.data[0]!;
        await route.fulfill({ response, json: { ...body, data: [...body.data, ...Array.from({ length: 80 }, (_, index) => ({ ...template, id: `overflow-${index}`, name: `Overflow chat ${index}`, activity: "idle" }))] } });
      });
      await signIn(page);
      const account = page.getByRole("tab", { name: "bot3", exact: true });
      await account.click();
      const list = page.locator(".thread-picker__list");
      await expect(list.getByRole("button")).toHaveCount(82);
      const dimensions = await list.evaluate(element => ({ height: element.clientHeight, content: element.scrollHeight }));
      expect(dimensions.content).toBeGreaterThan(dimensions.height);
      expect(dimensions.height).toBeLessThan(720);
      await list.getByRole("button", { name: "Overflow chat 79", exact: true }).scrollIntoViewIfNeeded();
      await expect(list.getByRole("button", { name: "Overflow chat 79", exact: true })).toBeInViewport();
      const bounds = await page.locator(".chats-page").boundingBox();
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(720);
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(720);
      if (width <= 768) await list.getByRole("button", { name: "T0 · Graph planning", exact: true }).click();
      const panel = (await page.locator(".chat-panel").boundingBox())!;
      expect(panel.x + panel.width).toBeCloseTo(width - 8, 0);
      await expect(page.getByRole("button", { name: "Send", exact: true })).toBeInViewport();
      await expect(page.locator(".chat-panel__toolbar")).toBeInViewport();
    });

    test(`grows and caps the Eden composer without moving its actions off-screen at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 720 });
      await signIn(page);
      await selectBot3Thread(page, "T0 · Graph planning");
      const input = page.getByRole("textbox", { name: "Message", exact: true });
      const surface = page.locator(".chat-compose__field [data-eden-textarea] .rt-TextAreaRoot");
      // Compare the same short content before/after expansion and reload;
      // the empty surface can have a different minimum height.
      await input.fill("Short draft");
      await page.evaluate(() => document.fonts.ready);
      const baseline = (await surface.boundingBox())!.height;
      await input.fill("A line\n".repeat(6));
      await expect.poll(async () => (await surface.boundingBox())!.height).toBeGreaterThan(baseline);
      await input.fill("A long draft line\n".repeat(50));
      await expect.poll(async () => (await surface.boundingBox())!.height).toBeLessThanOrEqual(200);
      expect(await input.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
      await expect(page.getByRole("button", { name: "Send", exact: true })).toBeInViewport();
      const options = page.getByText("Turn options", { exact: true });
      const steer = page.getByRole("button", { name: "Steer", exact: true });
      const optionsBox = (await options.boundingBox())!;
      const steerBox = (await steer.boundingBox())!;
      expect(optionsBox.x + optionsBox.width).toBeLessThanOrEqual(steerBox.x);
      expect(Math.abs(optionsBox.y - steerBox.y)).toBeLessThanOrEqual(1);
      await page.reload();
      await selectBot3Thread(page, "T0 · Graph planning");
      await expect(input).toHaveValue("A long draft line\n".repeat(50));
      expect((await surface.boundingBox())!.height).toBeLessThanOrEqual(200);
      await input.fill("Short draft");
      await expect.poll(async () => (await surface.boundingBox())!.height).toBeLessThanOrEqual(baseline + 1);
      await expect(input).toHaveAttribute("placeholder", "Work with Swarm...");
    });
  }

  for (const width of [390, 1440]) {
    test(`retains an unsent chat draft across page navigation and reload at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await signIn(page);
      await selectBot3Thread(page, "T0 · Graph planning");
      const composer = page.getByLabel("Message", { exact: true });
      await composer.fill(`Unsent draft at ${width}`);
      if (width < 768) await expect(page.locator(".app-nav")).toBeHidden();
      else await expect(page.locator(".app-nav")).toBeVisible();
      await page.getByRole("button", { name: "Scroll to bottom", exact: true }).click();
      await expect(page.locator(".app-nav")).toBeVisible();
      await page.getByRole("link", { name: "Todos", exact: true }).click();
      await page.getByRole("link", { name: "Chats", exact: true }).click();
      await selectBot3Thread(page, "T0 · Graph planning");
      await expect(composer).toHaveValue(`Unsent draft at ${width}`);
      await page.reload();
      await selectBot3Thread(page, "T0 · Graph planning");
      await expect(composer).toHaveValue(`Unsent draft at ${width}`);
    });
  }

  test("opens chats from a shared list and returns with Back to chats", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);
    await page.getByRole("tab", { name: "bot3", exact: true }).click();
    await expect(page.getByRole("list", { name: "Chats" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Message", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "New chat" })).toHaveClass(/density-compact/);
    await page.screenshot({ path: test.info().outputPath("mobile-chat-list.png") });
    await page.getByRole("button", { name: "T0 · Graph planning" }).click();
    await page.getByRole("textbox", { name: "Message", exact: true }).fill("Unsent mobile draft");
    await page.getByRole("button", { name: "Back to chats" }).click();
    await expect(page.getByRole("list", { name: "Chats" })).toBeVisible();
    await page.getByRole("button", { name: "T0 · Graph planning" }).click();
    await expect(page.getByRole("textbox", { name: "Message", exact: true })).toHaveValue("Unsent mobile draft");
  });

  test("keeps the selected chat composer and turn options on-screen on a narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);

    await selectBot3Thread(page, "T0 · Graph planning");
    const composer = page.locator(".chat-compose");
    await expect(composer).toBeVisible();
    const composerBox = await composer.boundingBox();
    expect(composerBox?.width).toBeGreaterThan(280);
    await page.getByText("Turn options").click();
    const optionsBox = await page.locator(".chat-compose__settings").boundingBox();
    expect(optionsBox?.y).toBeGreaterThanOrEqual(0);
    expect((optionsBox?.y ?? 0) + (optionsBox?.height ?? 0)).toBeLessThanOrEqual(844);
  });

  test("hides navigation while composing and uses superCompact Send within a narrow viewport", async ({ page }) => {
    const viewportWidth = 280;
    await page.setViewportSize({ width: viewportWidth, height: 568 });
    await signIn(page);
    const bot3 = page.getByRole("tab", { name: "bot3" });
    if (await bot3.getAttribute("aria-selected") !== "true") await bot3.click();
    await bot3.click();
    const thread = page.getByRole("button", { name: "T0 · Graph planning" });
    await expect(thread).toHaveAttribute("aria-pressed", "false");
    await thread.click();
    await expect(thread).toHaveCount(0);

    const send = page.getByRole("button", { name: "Send" });
    const nav = page.locator(".app-nav");
    await page.getByLabel("Message", { exact: true }).fill("Fixture operator message");
    await expect(send).toBeEnabled();
    await expect(nav).toBeHidden();
    await page.screenshot({ path: test.info().outputPath("plain-transcript-mobile.png") });

    await page.locator(".transcript-item__links").first().evaluate((links) => {
      const anchor = document.createElement("a");
      anchor.href = "/chats?open=long";
      anchor.textContent = `docs/${"mobileoverflowsegment".repeat(24)}runbook.md`;
      links.append(anchor);
    });

    const viewportOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(viewportOverflow).toBe(0);

    const longLink = page.locator(".transcript-item__links a", { hasText: "mobileoverflowsegment" });
    await expect(longLink).toBeVisible();
    const [sendBox, longLinkBox] = await Promise.all([send.boundingBox(), longLink.boundingBox()]);
    expect(sendBox).not.toBeNull();
    expect(longLinkBox).not.toBeNull();
    expect(sendBox!.width).toBeGreaterThanOrEqual(28);
    expect(sendBox!.height).toBeGreaterThanOrEqual(28);
    expect(sendBox!.x + sendBox!.width).toBeLessThanOrEqual(viewportWidth);
    expect(sendBox!.y + sendBox!.height).toBeLessThanOrEqual(568);
    expect(longLinkBox!.x + longLinkBox!.width).toBeLessThanOrEqual(viewportWidth);

    await send.click();
    await expect(nav).toBeVisible();
    await expect(page.locator('.rt-ToastRoot[data-state="open"]')).toContainText("Message sent.");
  });

  test("shows normalized transcript details, approved controls, and capability gating", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);
    await selectBot3Thread(page, "T0 · Graph planning");
    await expect(page.getByRole("dialog", { name: "Rename chat" })).toHaveCount(0);

    const transcript = page.getByTestId("transcript-scroll");
    await expect.poll(async () => transcript.evaluate((element) => Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop))).toBeLessThanOrEqual(2);
    const command = transcript.getByRole("article", { name: "commandExecution" });
    await expect(command.getByText("Command", { exact: true })).toHaveCount(0);
    await expect(command.getByRole("button", { name: /^Expand Command:/ })).toContainText("git status --short");
    const files = transcript.getByRole("article", { name: "fileChange" });
    await expect(files.getByRole("link")).toHaveCount(0);
    for (const article of [command, files, transcript.getByRole("article", { name: "agentMessage" }).first()]) {
      await expect(article).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      await expect(article).toHaveCSS("border-top-width", "0px");
      await expect(article).toHaveCSS("box-shadow", "none");
    }
    await page.screenshot({ path: test.info().outputPath("plain-transcript-desktop.png") });
    await command.getByRole("button", { name: /^Expand Command:/ }).click();
    await expect(command.locator("pre").nth(0)).toHaveText("git status --short");
    await expect(command.locator("pre").nth(1)).toHaveText(" M workers-masterplan/swarm/src/client/App.tsx\n");
    await transcript.evaluate((element) => { element.scrollTop = 72; });
    const runbookLink = page.getByRole("link", { name: "docs/runbook.md" });
    await runbookLink.scrollIntoViewIfNeeded();
    const scrollBeforeViewer = await transcript.evaluate((element) => element.scrollTop);
    await runbookLink.click();
    await expect(page).toHaveURL(/\/\?file=docs%2Frunbook\.md&account=bot3$/);
    const viewer = page.getByRole("dialog", { name: "runbook.md" });
    await expect(viewer).toBeVisible();
    await expect(viewer.locator("script")).toHaveCount(0);
    await expect(viewer.getByRole("heading", { name: "Runbook", exact: true })).toBeVisible();
    await viewer.getByRole("button", { name: "Close modal" }).click();
    await expect(viewer).toHaveCount(0);
    await expect.poll(async () => Math.abs(await transcript.evaluate((element) => element.scrollTop) - scrollBeforeViewer)).toBeLessThanOrEqual(1);
    await page.getByRole("button", { name: /^Expand Files changed:/ }).click();
    await page.getByRole("link", { name: "src/client/App.tsx", exact: true }).click();
    const sourceViewer = page.getByRole("dialog", { name: "App.tsx" });
    await expect(sourceViewer.locator("pre")).toHaveText("export function App() { return null; }");
    await expect(sourceViewer.locator(".hljs-keyword").first()).toHaveText("export");
    await expect(sourceViewer.getByText("typescript", { exact: true })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("highlighted-source.png") });
    await sourceViewer.getByRole("button", { name: "Close modal" }).click();

    for (const name of ["Send", "Archive chat", "Interrupt"]) await expect(page.getByRole("button", { name, exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Steer" })).toBeDisabled();
    const targetSizes = await page.locator(".chat-compose button:visible").evaluateAll((buttons) => buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return { width: box.width, height: box.height };
    }));
    expect(targetSizes.every(({ width, height }) => width >= 28 && height >= 28)).toBe(true);

    await page.getByRole("button", { name: "Decline approval" }).first().click();
    const toast = page.locator('.rt-ToastRoot[data-state="open"]');
    await expect(toast).toContainText("Approval response sent.");
    await page.getByLabel("Message", { exact: true }).fill("Fixture operator message");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(toast).toContainText("Message sent.");
    await page.getByLabel("Message", { exact: true }).fill("Clarify the fixture handoff");
    await expect(page.getByRole("button", { name: "Steer" })).toBeDisabled();
    await page.getByRole("button", { name: "Interrupt" }).click();
    await expect(toast).toContainText("Turn interrupted.");

    await page.getByRole("button", { name: "U1 · Coordinator UI" }).click();
    await expect(page.getByRole("button", { name: "Send" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Archive chat" })).toBeEnabled();
    for (const name of ["Steer", "Interrupt"]) await expect(page.getByRole("button", { name })).toBeDisabled();

    await page.getByRole("button", { name: "T0 · Graph planning" }).click();
    await page.getByRole("button", { name: "Archive chat" }).click();
    await expect(toast).toContainText("Chat archived.");
    await page.getByRole("button", { name: "New chat" }).click();
    await expect(page.getByRole("region", { name: "New chat" })).toBeVisible();
    await page.getByLabel("Message", { exact: true }).fill("Start a fixture chat");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(toast).toContainText("Message sent.");
  });
});
