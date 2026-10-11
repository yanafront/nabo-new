import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const seed = JSON.parse(
  readFileSync(new URL("../fixtures/recipes.json", import.meta.url), "utf8"),
);
const recipe = seed.recipes.find((r: any) => r.slug === "syrniki");
test.beforeEach(async ({ page }) => {
  await page.route("**/api/recipes/syrniki", (route) =>
    route.fulfill({ json: { recipe, ingredients: seed.ingredients } }),
  );
});
test("restaurant offers show portions, prices and external links without changing servings", async ({
  page,
}) => {
  let requests = 0;
  await page.route("https://cdn.delivio.by/test-*.jpg", (route) => {
    if (route.request().url().includes("broken"))
      return route.fulfill({ status: 404 });
    const height = route.request().url().includes("tall") ? 600 : 50;
    return route.fulfill({
      contentType: "image/svg+xml",
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="${height}"><rect width="200" height="${height}" fill="#f1e4d2"/></svg>`,
    });
  });
  await page.route("**/api/dining/search?*", (route) => {
    requests++;
    expect(new URL(route.request().url()).searchParams.get("q")).toBe(
      recipe.title,
    );
    return route.fulfill({
      json: {
        offers: [
          {
            image: "https://cdn.delivio.by/test-wide.jpg",
            id: "1",
            name: "Сырники",
            restaurant: "Кафе",
            price: 9,
            portion: "180 г",
            available: true,
            url: "https://delivio.by/restaurant/cafe",
          },
          {
            id: "2",
            name: "Сырники с ягодами, сметаной и очень длинным названием",
            restaurant: "Кафе с длинным названием на улице Победителей",
            price: 12,
            portion: "250 г",
            available: true,
            url: "https://delivio.by/restaurant/second",
            image: "https://cdn.delivio.by/test-tall.jpg",
          },
          {
            id: "3",
            name: "Сырники",
            restaurant: "Без фото",
            price: 14,
            portion: "200 г",
            available: true,
            url: "https://delivio.by/restaurant/third",
            image: "https://cdn.delivio.by/test-broken.jpg",
          },
          {
            id: "4",
            name: "Сырники с джемом",
            restaurant: "Завтраки",
            price: 15,
            portion: "210 г",
            available: false,
            url: "https://delivio.by/restaurant/fourth",
          },
        ],
        searchUrl: "https://delivio.by/search?type=1&q=сырники",
        checkedAt: "2026-10-11",
        limited: false,
      },
    });
  });
  await page.goto("/recipes/syrniki");
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  const cookies = page.getByRole("button", {
    name: "Только необходимые",
    exact: true,
  });
  if (await cookies.isVisible()) await cookies.click();
  const block = page.locator(".recipe-dining");
  await expect(block.getByText("от 9,00 BYN")).toBeVisible();
  await expect(block.getByText("Кафе", { exact: true }).first()).toBeVisible();
  await expect(block.getByText("180 г", { exact: true }).first()).toBeVisible();
  await expect(
    block.getByRole("link", { name: "Открыть Кафе в Delivio" }),
  ).toHaveAttribute("href", "https://delivio.by/restaurant/cafe");
  await page
    .getByRole("button", { name: "Увеличить порции", exact: true })
    .click();
  expect(requests).toBe(1);
  await expect(block.getByText("от 9,00 BYN")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await block.locator(".dining-card").last().scrollIntoViewIfNeeded();
  await expect(block.locator(".dining-card")).toHaveCount(4);
  await expect(block.locator(".dining-image-placeholder")).toHaveCount(2);
  const dimensions = await block
    .locator(".dining-image")
    .evaluateAll((elements) =>
      elements.map((el) => ({
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height,
      })),
    );
  expect(
    Math.max(...dimensions.map((d) => d.height)) -
      Math.min(...dimensions.map((d) => d.height)),
  ).toBeLessThan(1);
  const columns = await block
    .locator(".dining-offers")
    .evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
    );
  expect(columns).toBe(test.info().project.name === "mobile" ? 2 : 4);
  const cookSummary = await block.locator(".cook-summary").boundingBox();
  const diningSummary = await block.locator(".dining-heading").boundingBox();
  expect(Math.abs(cookSummary!.y - diningSummary!.y)).toBeLessThan(1);
  await expect(block.getByText("Цена продуктов — после подбора")).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Добавить ингредиенты в корзину",
      exact: true,
    }),
  ).toBeEnabled();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(
    block.getByRole("link", { name: "Заказать готовое", exact: true }),
  ).toHaveAttribute("href", "#recipe-ready-offers");
  await expect(
    page.getByRole("heading", { name: "Как приготовить", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".recipe-instructions ol li").first(),
  ).toBeVisible();
  const cover = await page.locator(".recipe-cover").boundingBox();
  const image = await page.locator(".recipe-cover img").boundingBox();
  expect(Math.abs(cover!.height - image!.height)).toBeLessThan(1);
  await page.screenshot({
    path: `/tmp/nabo-recipe-after-${test.info().project.name}.png`,
    fullPage: true,
  });
  await block.screenshot({
    path: `/tmp/nabo-dining-${test.info().project.name}.png`,
  });
});
test("a source outage leaves the recipe and basket action usable", async ({
  page,
}) => {
  await page.route("**/api/dining/search?*", (route) =>
    route.fulfill({ status: 502, json: {} }),
  );
  await page.goto("/recipes/syrniki");
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  const cookies = page.getByRole("button", {
    name: "Только необходимые",
    exact: true,
  });
  if (await cookies.isVisible()) await cookies.click();
  await expect(
    page
      .locator(".recipe-dining")
      .getByText("Не удалось загрузить предложения.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Добавить ингредиенты в корзину",
      exact: true,
    }),
  ).toBeEnabled();
  await expect(
    page
      .locator(".recipe-dining")
      .getByRole("link", { name: "Все предложения в Delivio" }),
  ).toBeVisible();
});
test("no matching dishes does not invent a price", async ({ page }) => {
  await page.route("**/api/dining/search?*", (route) =>
    route.fulfill({
      json: {
        offers: [],
        searchUrl: "https://delivio.by/search?type=1&q=сырники",
        limited: false,
        checkedAt: "2026-10-11",
      },
    }),
  );
  await page.goto("/recipes/syrniki");
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  const cookies = page.getByRole("button", {
    name: "Только необходимые",
    exact: true,
  });
  if (await cookies.isVisible()) await cookies.click();
  await expect(
    page.locator(".recipe-dining").getByText(/предложений пока нет/),
  ).toBeVisible();
  await expect(page.locator(".dining-from")).toHaveCount(0);
});
