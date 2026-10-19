import { test, expect } from "@playwright/test";
test("editor can diagnose keys and seed the real product index without touching the cart", async ({
  page,
}) => {
  let ready = false,
    imported = false,
    cartMutations = 0;
  await page.route("**/api/cart", (route) => {
    if (route.request().method() !== "GET") cartMutations++;
    return route.fulfill({ status: 401, json: {} });
  });
  await page.route("**/api/admin/seo-products/check", (route) =>
    route.fulfill({
      json: {
        keyConfigured: ready,
        connection: ready ? "ready" : "missing_key",
        products: imported ? 12 : 0,
      },
    }),
  );
  await page.route("**/api/admin/seo-products/import", (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      storeId: "green",
      queries: ["Молоко", "Яйца куриные", "Сметана"],
    });
    imported = true;
    return route.fulfill({
      json: { saved: 12, queries: 3, failedQueries: [] },
    });
  });
  await page.goto("/admin/seo-products");
  const consent = page.getByRole("button", {
    name: "Только необходимые",
    exact: true,
  });
  if (await consent.isVisible()) await consent.click();
  const button = page.getByRole("button", {
    name: "Найти и добавить в индекс",
    exact: true,
  });
  await expect(
    page.getByText("На Vercel не задан NUXT_SEO_INGEST_KEY."),
  ).toBeVisible();
  await expect(button).toBeDisabled();
  ready = true;
  await page.getByRole("button", { name: "Проверить", exact: true }).click();
  await expect(
    page.getByText("Ключ принят, наполнение индекса доступно."),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Магазин", exact: true })
    .selectOption("green");
  await button.click();
  await expect(
    page.getByText("Обработано: 12 товаров.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("12 товаров в актуальном индексе")).toBeVisible();
  expect(cartMutations).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
});
test("SEO controls require an editor account", async ({ page }) => {
  let status = 401;
  await page.route("**/api/admin/seo-products/check", (route) =>
    route.fulfill({ status, json: { message: "Denied" } }),
  );
  await page.goto("/admin/seo-products");
  await expect(
    page.getByRole("link", { name: "Войти в служебный аккаунт", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".seo-import")).toHaveCount(0);
  status = 403;
  await page.reload();
  await expect(
    page.getByText("Страница доступна только редактору."),
  ).toBeVisible();
  await expect(page.locator(".seo-import")).toHaveCount(0);
});
