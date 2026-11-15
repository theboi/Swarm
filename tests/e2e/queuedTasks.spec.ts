import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/");
  await page.getByLabel("Email").fill("operator@fixture.test");
  await page.getByLabel("Password").fill("fixture-only-password");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Authentication code").fill("123456");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("link", { name: "Todos" }).click();
}

test("keeps long descriptions and many todos within their rows at narrow widths", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await signIn(page);
  await createList(page, `Long descriptions ${Date.now()}`);
  const listId = new URL(page.url()).searchParams.get("list");
  for (let index = 0; index < 12; index++) {
    const result = await page.request.post("/api/v1/queued-tasks", { data: { listId, description: `Todo ${index}\n${"UnbrokenDescription".repeat(40)}` } });
    expect(result.ok()).toBe(true);
  }
  await page.reload();
  await expect(page.getByRole("button", { name: "Edit description" })).toHaveCount(12);
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    const fit = await page.getByRole("button", { name: "Edit description" }).evaluateAll(buttons => buttons.every(button => {
      const range = document.createRange(); range.selectNodeContents(button);
      return range.getBoundingClientRect().bottom <= button.closest("li")!.getBoundingClientRect().bottom;
    }));
    expect(fit).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `/tmp/swarm-queued-long-${width}.png` });
    await page.getByRole("button", { name: "Add todo" }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("button", { name: "Add todo" })).toBeInViewport();
    await page.evaluate(() => scrollTo(0, 0));
  }
});

test("mobile Back and Lists recovery work after a missing-list read", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await createList(page, `Navigation ${Date.now()}`);
  await page.goBack();
  await expect(page.getByRole("button", { name: "Create List" })).toBeVisible();
  await page.goto("/todos?list=missing");
  await expect(page.getByRole("region", { name: "Todos" }).getByRole("alert")).toContainText("List not found");
  await page.getByRole("button", { name: "Lists", exact: true }).click();
  await expect(page.getByRole("button", { name: "Create List" })).toBeVisible();
});
async function createList(page: Page, name: string) {
  await page.getByRole("button", { name: "Create List" }).click();
  await page.getByLabel("List name").fill(name);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add todo" })).toBeVisible();
}
async function addTodo(page: Page, description: string) {
  await page.getByRole("button", { name: "Add todo" }).click();
  await page.getByRole("textbox", { name: "Description", exact: true }).fill(description);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit description" }).filter({ hasText: description.trim() })).toBeVisible();
}
for (const width of [390, 1440]) {
  test(`lists, description editing, states, move and delete persist at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);
    const name = `Work ${width} ${Date.now()}`;
    await createList(page, name);
    const listURL = page.url();
    await addTodo(page, "  Investigate the login failure.\nPreserve this description.\n");
    await expect(page.getByRole("button", { name: "Add todo" })).toBeFocused();
    await page.reload();
    expect(page.url()).toBe(listURL);
    await expect(page.getByRole("button", { name: "Edit description" })).toBeVisible();
    await page.getByRole("button", { name: "Todo state: Todo", exact: true }).click();
    await page.getByRole("radio", { name: "Todo (priority)", exact: true }).click();
    await expect(page.getByRole("button", { name: "Todo state: Todo (priority)" })).toBeVisible();
    await page.getByRole("button", { name: "Edit description" }).click();
    await expect(page.getByRole("textbox", { name: "Description", exact: true })).toBeFocused();
    await page.getByRole("textbox", { name: "Description", exact: true }).fill(" Edited exact description.\n");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("button", { name: "Edit description" })).toBeFocused();
    await page.reload();
    await expect(page.getByText("Edited exact description.", { exact: true })).toBeVisible();
    await page.screenshot({ path: `/tmp/swarm-queued-tasks-${width}.png`, fullPage: true });
    if (width < 768) {
      await expect(page.getByRole("button", { name: "Create List" })).not.toBeVisible();
      await page.getByRole("button", { name: "Lists", exact: true }).click();
      await expect(page.getByRole("button", { name: "Create List" })).toBeVisible();
    }
    const destination = `Destination ${width} ${Date.now()}`;
    await createList(page, destination);
    if (width < 768) await page.getByRole("button", { name: "Lists", exact: true }).click();
    await page.getByRole("button", { name, exact: true }).click();
    await page.getByRole("button", { name: "Todo actions" }).click();
    await page.getByRole("button", { name: "Move to List..." }).click();
    await page.getByRole("button", { name: /^List:/ }).click();
    await page.getByRole("radio", { name: destination, exact: true }).click();
    await page.getByRole("button", { name: "Move", exact: true }).click();
    await expect(page.getByRole("button", { name: "Edit description" })).toHaveCount(0);
    if (width < 768) await page.getByRole("button", { name: "Lists", exact: true }).click();
    await page.getByRole("button", { name: destination, exact: true }).click();
    await page.getByRole("button", { name: "Todo state: Todo (priority)" }).click();
    await page.getByRole("radio", { name: "In Progress", exact: true }).click();
    await page.getByRole("button", { name: "Todo state: In Progress" }).click();
    await page.getByRole("radio", { name: "Complete", exact: true }).click();
    await page.reload();
    await expect(page.getByRole("button", { name: "Todo state: Complete" })).toBeVisible();
    await page.getByRole("button", { name: "Todo actions" }).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("button", { name: "Edit description" })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("button", { name: "Edit description" })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test(`sends a description verbatim to a selected bot at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);
    await createList(page, `Send ${width} ${Date.now()}`);
    const description = "  Use this exact description.\nKeep whitespace.\n";
    await addTodo(page, description);
    await page.getByRole("button", { name: "Todo actions" }).click();
    await page.getByRole("button", { name: "Send to..." }).click();
    await expect(page.getByRole("button", { name: /^Bot:/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Todo actions" })).toBeFocused();
    await page.getByRole("button", { name: "Todo actions" }).click();
    await page.getByRole("button", { name: "Send to..." }).click();
    await page.getByRole("button", { name: /^Bot:/ }).click();
    await page.getByRole("radio", { name: "bot3", exact: true }).click();
    const sent = page.waitForRequest(request => request.method() === "POST" && /accounts\/bot3\/threads\/[^/]+\/turns$/.test(new URL(request.url()).pathname));
    await page.getByRole("button", { name: "Send", exact: true }).click();
    expect((await sent).postDataJSON()).toMatchObject({ text: description, clientUserMessageId: expect.any(String) });
    await expect(page.getByRole("region", { name: "Chat workspace" })).toBeVisible();
  });
}
