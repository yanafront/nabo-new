import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { RecipeCatalog } from "../../shared/recipe/model";
const seed = JSON.parse(
  readFileSync(
    new URL("../../data/recipe-catalog.json", import.meta.url),
    "utf8",
  ),
) as RecipeCatalog;
test("редактор сохраняет отдельные поисковые названия и различает черновик и публикацию", async ({
  page,
}) => {
  const recipe = structuredClone(
    seed.recipes.find((r) => r.slug === "syrniki")!,
  );
  const ingredients = seed.ingredients.filter((i) =>
    recipe.ingredients.some((row) => row.ingredientId === i.id),
  );
  const requests: any[] = [];
  await page.route("**/api/admin/recipes", (route) =>
    route.fulfill({
      json: {
        records: [
          {
            slug: recipe.slug,
            revision: 1,
            published: true,
            document: { recipe, ingredients },
          },
        ],
        catalog: { ...seed, recipes: [recipe] },
        photosConfigured: false,
        catalogEnabled: true,
      },
    }),
  );
  await page.route("**/api/admin/recipes/syrniki", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ json: { revision: requests.length + 1 } });
  });
  await page.goto("/admin/recipes");
  await page.getByRole("button", { name: /Сырники.*Есть редакция/ }).click();
  await page
    .getByLabel("Поисковый запрос", { exact: true })
    .first()
    .fill("Творог 5%");
  await page
    .getByLabel("Точное название товара — необязательно", { exact: true })
    .first()
    .fill("Творог Савушкин 5% 200 г");
  await page
    .getByLabel("Фасовка выбранного товара", { exact: true })
    .first()
    .fill("200 г");
  await page
    .getByRole("button", { name: "Сохранить черновик", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Черновик сохранён");
  expect(requests[0].publish).toBe(false);
  expect(requests[0].revision).toBe(1);
  expect(requests[0].document.recipe.ingredients[0].name).toBe(
    recipe.ingredients[0].name,
  );
  expect(requests[0].document.recipe.ingredients[0].searchQuery).toBe(
    "Творог 5%",
  );
  expect(requests[0].document.recipe.ingredients[0].exactUnit).toBe("200 г");
  await page.getByRole("button", { name: "Опубликовать", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Рецепт опубликован.");
  expect(requests[1].publish).toBe(true);
  expect(requests[1].revision).toBe(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/tmp/nabo-admin-${test.info().project.name}.png`,
    fullPage: false,
  });
});
test("гость видит вход, а обычный аккаунт не видит рецепты редактора", async ({
  page,
}) => {
  await page.route("**/api/admin/recipes", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await page.goto("/admin/recipes");
  await expect(
    page.getByRole("link", { name: "Войти", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Новый рецепт", exact: true }),
  ).toHaveCount(0);
  await page.unroute("**/api/admin/recipes");
  await page.route("**/api/admin/recipes", (route) =>
    route.fulfill({ status: 403, json: {} }),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("нет доступа");
  await expect(page.getByLabel("Найти рецепт")).toHaveCount(0);
});
