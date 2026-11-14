import { expect, test, type Page } from "@playwright/test";

import { FIXTURE_CREDENTIALS } from "./fixtureData.js";

async function signIn(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByLabel("Email").fill(FIXTURE_CREDENTIALS.email);
  await page.getByLabel("Password").fill(FIXTURE_CREDENTIALS.password);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Authentication code").fill("123456");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("link", { name: "Chats", exact: true }).click();
  await expect(page.getByRole("region", { name: "Chats" })).toBeVisible();
}

async function selectBot3Thread(page: Page, name: string): Promise<void> {
  const account = page.getByRole("button", { name: "bot3" });
  if (await account.getAttribute("aria-pressed") !== "true") await account.click();
  const thread = page.getByRole("button", { name });
  await expect(thread).toHaveAttribute("aria-pressed", "true");
}

test.describe("Chats", () => {
  test.describe.configure({ mode: "serial" });

  for (const width of [390, 1440]) {
    test(`retains an unsent chat draft across page navigation and reload at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await signIn(page);
      await page.getByRole("button", { name: "bot3", exact: true }).click();
      const composer = page.getByLabel("Message", { exact: true });
      await composer.fill(`Unsent draft at ${width}`);
      if (width < 768) await expect(page.locator(".app-nav")).toBeHidden();
      else await expect(page.locator(".app-nav")).toBeVisible();
      await composer.blur();
      await page.getByRole("link", { name: "Home", exact: true }).click();
      await page.getByRole("link", { name: "Chats", exact: true }).click();
      await page.getByRole("button", { name: "bot3", exact: true }).click();
      await expect(composer).toHaveValue(`Unsent draft at ${width}`);
      await page.reload();
      await page.getByRole("button", { name: "bot3", exact: true }).click();
      await expect(composer).toHaveValue(`Unsent draft at ${width}`);
    });
  }

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

  test("keeps the selected chat composer and turn options on-screen on a narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);

    const composer = page.locator(".chat-compose");
    await expect(composer).toBeVisible();
    const composerBox = await composer.boundingBox();
    expect(composerBox?.width).toBeGreaterThan(280);
    await page.getByText("Turn options").click();
    const optionsBox = await page.locator(".chat-compose__settings").boundingBox();
    expect(optionsBox?.y).toBeGreaterThanOrEqual(0);
    expect((optionsBox?.y ?? 0) + (optionsBox?.height ?? 0)).toBeLessThanOrEqual(844);
  });

  test("hides navigation while composing and keeps a 44px Send target within a narrow viewport", async ({ page }) => {
    const viewportWidth = 280;
    await page.setViewportSize({ width: viewportWidth, height: 568 });
    await signIn(page);
    const bot3 = page.getByRole("button", { name: "bot3" });
    if (await bot3.getAttribute("aria-pressed") !== "true") await bot3.click();
    await bot3.click();
    const thread = page.getByRole("button", { name: "T0 · Graph planning" });
    await expect(thread).toHaveAttribute("aria-pressed", "true");
    await thread.click();
    await expect(thread).toHaveCount(0);

    const send = page.getByRole("button", { name: "Send" });
    const nav = page.locator(".app-nav");
    await page.getByLabel("Message", { exact: true }).fill("Fixture operator message");
    await expect(send).toBeEnabled();
    await expect(nav).toBeHidden();

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
    expect(sendBox!.width).toBeGreaterThanOrEqual(44);
    expect(sendBox!.height).toBeGreaterThanOrEqual(44);
    expect(sendBox!.x + sendBox!.width).toBeLessThanOrEqual(viewportWidth);
    expect(sendBox!.y + sendBox!.height).toBeLessThanOrEqual(568);
    expect(longLinkBox!.x + longLinkBox!.width).toBeLessThanOrEqual(viewportWidth);

    await send.click();
    await expect(nav).toBeVisible();
    await expect(page.locator(".rt-ToastRoot")).toContainText("Message sent.");
  });

  test("shows normalized transcript details, approved controls, and capability gating", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signIn(page);
    await selectBot3Thread(page, "T0 · Graph planning");
    await expect(page.getByRole("dialog", { name: "Rename chat" })).toHaveCount(0);

    const transcript = page.getByTestId("transcript-scroll");
    await expect.poll(async () => transcript.evaluate((element) => Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop))).toBeLessThanOrEqual(2);
    const command = transcript.getByRole("article", { name: "commandExecution" });
    await command.getByRole("button", { name: "Expand Command" }).click();
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
    await page.getByRole("link", { name: "src/client/App.tsx", exact: true }).click();
    const sourceViewer = page.getByRole("dialog", { name: "App.tsx" });
    await expect(sourceViewer.locator("pre")).toHaveText("export function App() { return null; }");
    await sourceViewer.getByRole("button", { name: "Close modal" }).click();

    for (const name of ["Send", "Archive chat", "Interrupt"]) await expect(page.getByRole("button", { name, exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Steer" })).toBeDisabled();
    const targetSizes = await page.locator(".chat-compose button:visible").evaluateAll((buttons) => buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return { width: box.width, height: box.height };
    }));
    expect(targetSizes.every(({ width, height }) => width >= 36 && height >= 36)).toBe(true);

    await page.getByRole("button", { name: "Decline approval" }).first().click();
    const toast = page.locator(".rt-ToastRoot");
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
    await expect(page.getByRole("status")).toHaveText("Chat archived.");
    await page.getByRole("button", { name: "New chat" }).click();
    await expect(page.getByRole("heading", { name: "New chat" })).toBeVisible();
    await page.getByLabel("Message", { exact: true }).fill("Start a fixture chat");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(toast).toContainText("Message sent.");
  });
});
