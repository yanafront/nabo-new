import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    class Speech {
      lang = "";
      continuous = false;
      interimResults = false;
      onresult: any;
      onend: any;
      onerror: any;
      constructor() {
        (window as any).__speech = this;
      }
      start() {}
      stop() {
        this.onend?.();
      }
      abort() {}
    }
    Object.defineProperty(window, "SpeechRecognition", {
      value: Speech,
      configurable: true,
    });
  });
});
test("voice product search waits for final speech and sends one query", async ({
  page,
}) => {
  const requests: any[] = [];
  await page.route("**/api/search", (r) => {
    requests.push(r.request().postDataJSON());
    return r.fulfill({ json: { stores: [], fetchedAt: "now" } });
  });
  await page.goto("/products");
  await page
    .getByRole("button", { name: "Ввести голосом", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Остановить голосовой ввод",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => {
    const s = (window as any).__speech;
    s.onresult({ results: [{ isFinal: false, 0: { transcript: "Моло" } }] });
  });
  expect(requests).toHaveLength(0);
  await page.evaluate(() => {
    const s = (window as any).__speech;
    s.onresult({ results: [{ isFinal: true, 0: { transcript: "Молоко" } }] });
    s.onend();
  });
  await expect(
    page.getByRole("textbox", { name: "Поиск товаров", exact: true }),
  ).toHaveValue("Молоко");
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0].query).toBe("молоко");
  await expect(
    page.getByRole("button", { name: "Ввести голосом", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
});
test("microphone denial keeps typed search available and shows a toast", async ({
  page,
}) => {
  await page.goto("/products");
  await page
    .getByRole("textbox", { name: "Поиск товаров", exact: true })
    .fill("Сметана");
  await page
    .getByRole("button", { name: "Ввести голосом", exact: true })
    .click();
  await page.evaluate(() => {
    const s = (window as any).__speech;
    s.onerror({ error: "not-allowed" });
    s.onend();
  });
  await expect(
    page.getByRole("alert").filter({ hasText: "Разрешите доступ к микрофону" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Поиск товаров", exact: true }),
  ).toHaveValue("Сметана");
});

test("recipe voice search updates the field and searches once", async ({
  page,
}) => {
  const queries: string[] = [];
  await page.route("**/api/recipes?**", (r) => {
    const u = new URL(r.request().url());
    if (u.searchParams.get("view") === "categories")
      return r.fulfill({ json: { sections: [] } });
    queries.push(u.searchParams.get("q") || "");
    return r.fulfill({ json: { recipes: [], total: 0 } });
  });
  await page.goto("/products");
  await page.locator('a[href="/recipes"]:visible').first().click();
  await expect(page).toHaveURL(/\/recipes$/);
  await expect(
    page.getByRole("textbox", { name: "Поиск рецептов", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ввести голосом", exact: true })
    .click();
  await page.evaluate(() => {
    const s = (window as any).__speech;
    s.onresult({ results: [{ isFinal: true, 0: { transcript: "Сырники" } }] });
    s.onend();
  });
  await expect(
    page.getByRole("textbox", { name: "Поиск рецептов", exact: true }),
  ).toHaveValue("Сырники");
  await expect
    .poll(() => queries.filter((q) => q === "Сырники").length)
    .toBe(1);
  await expect(page).toHaveURL(/\/recipes\?q=/);
});
