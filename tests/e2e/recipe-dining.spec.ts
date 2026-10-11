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
  await page.route("**/api/dining/search?*", (route) => {
    requests++;
    expect(new URL(route.request().url()).searchParams.get("q")).toBe(
      recipe.title,
    );
    return route.fulfill({
      json: {
        offers: [
          {
            id: "1",
            name: "Сырники",
            restaurant: "Кафе",
            price: 9,
            portion: "180 г",
            available: true,
            url: "https://delivio.by/restaurant/cafe",
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
  await expect(block.getByText("Кафе · 180 г")).toBeVisible();
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
