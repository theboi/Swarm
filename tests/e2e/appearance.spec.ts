import { expect, test } from "@playwright/test";

for (const width of [320, 768, 1024, 1440]) {
  test(`copied chrome and saved appearance work at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/settings/appearance");
    await page.getByLabel("Email").fill("operator@fixture.test");
    await page.getByLabel("Password").fill("fixture-only-password");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Authentication code").fill("123456");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Color theme" })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Primary navigation" });
    await expect(nav).toHaveAttribute("data-variant", width < 768 ? "mobile" : width < 1280 ? "tablet" : "desktop");
    expect(await page.getByRole("main").count()).toBe(1);
    await expect(page.getByRole("button", { name: "Dark", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Light", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator(".radix-themes").first()).toHaveClass(/light/);
    await page.reload();
    await expect(page.getByRole("button", { name: "Light", exact: true })).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/swarm-appearance-light-${width}.png`, fullPage: true });
    const settingsNav = page.getByRole("navigation", { name: "Settings sections" });
    await expect(settingsNav.getByRole("link", { name: "Appearance" })).toHaveAttribute("aria-current", "page");
    if (width < 768) {
      const more = nav.getByRole("button", { name: "More", exact: true });
      await more.click();
      await expect(nav.getByRole("link", { name: "Settings", exact: true })).toHaveAttribute("aria-current", "page");
      await nav.getByRole("link", { name: "Chats", exact: true }).focus();
      await page.keyboard.press("Escape");
      await expect(more).toBeFocused();
      await expect(more).toHaveAttribute("aria-expanded", "false");
    } else {
      expect(await nav.getByRole("link", { name: "Settings", exact: true }).textContent()).toBe("");
      expect(await nav.boundingBox()).toMatchObject({ width: 88 });
    }
    await page.getByRole("button", { name: "Dark", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.screenshot({ path: `/tmp/swarm-appearance-dark-${width}.png`, fullPage: true });
    await nav.getByRole("link", { name: "Home", exact: true }).click();
    if (width < 768) await nav.getByRole("button", { name: "More", exact: true }).click();
    await nav.getByRole("link", { name: "Settings", exact: true }).click();
    await expect(page).toHaveURL(/\/settings\/appearance$/);
    await expect(page.getByRole("button", { name: "Dark", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings\/appearance$/);
    await expect(page.getByRole("heading", { name: "Color theme" })).toBeVisible();
  });
}
