import { test, expect } from "@playwright/test";
import {
  parseRecipeJson,
  recipeJsonExample,
} from "../../shared/recipe/json-editor";
function record(slug: string, title: string, category: string, tags: string[]) {
  const document = parseRecipeJson(JSON.stringify(recipeJsonExample));
  document.recipe = {
    ...document.recipe,
    slug,
    title,
    categoryId: category,
    tags,
  };
  return { slug, revision: 3, published: true, document };
}
test("all recipes can be classified through the table, with partial saves and no document publication", async ({
  page,
}) => {
  const records = [
    record("salat", "Салат с овощами", "mains", ["custom", "easy"]),
    record("sup", "Суп", "soups", []),
  ];
  await page.route("**/api/admin/recipes", (route) =>
    route.fulfill({
      json: {
        records,
        categories: [
          { id: "mains", title: "Основные блюда" },
          { id: "salads", title: "Салаты" },
          { id: "soups", title: "Супы" },
        ],
      },
    }),
  );
  const writes: any[] = [];
  await page.route("**/api/admin/recipes/*/classification", (route) => {
    expect(route.request().method()).toBe("PATCH");
    writes.push(route.request().postDataJSON());
    return route.fulfill({ json: { revision: 4 } });
  });
  await page.goto("/admin/recipe-classification");
  const cookies = page.getByRole("button", {
    name: "Только необходимые",
    exact: true,
  });
  if (await cookies.isVisible()) await cookies.click();
  const heading = await page
    .getByRole("heading", { name: "Категории и подборки", exact: true })
    .boundingBox();
  expect(heading!.width).toBeGreaterThan(250);
  await expect(
    page.getByRole("link", { name: "Салат с овощами", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Суп", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "Салат с овощами: Салаты", exact: true })
    .check();
  await expect(
    page.getByRole("checkbox", {
      name: "Салат с овощами: Основные блюда",
      exact: true,
    }),
  ).not.toBeChecked();
  await page.getByRole("tab", { name: "Подборки", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Салат с овощами: Для семьи", exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: "Суп: Бюджетно", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Сохранить изменения", exact: true })
    .click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[0]).toEqual({
    revision: 3,
    categoryId: "salads",
    collections: { add: ["family"], remove: [] },
  });
  expect(writes[1]).toEqual({
    revision: 3,
    collections: { add: ["budget"], remove: [] },
  });
  await expect(
    page.getByRole("button", { name: "Сохранить изменения", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Найти блюдо", { exact: true }).fill("салат");
  await expect(
    page.getByRole("link", { name: "Суп", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/tmp/nabo-classification-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test("a conflicting row keeps its marks and can be reviewed against the current revision", async ({
  page,
}) => {
  let current = record("salat", "Салат", "mains", []);
  await page.route("**/api/admin/recipes", (route) =>
    route.fulfill({ json: { records: [current] } }),
  );
  const bodies: any[] = [];
  await page.route("**/api/admin/recipes/salat/classification", (route) => {
    bodies.push(route.request().postDataJSON());
    if (bodies.length === 1) {
      current = {
        ...record("salat", "Салат", "salads", ["budget"]),
        revision: 5,
      };
      return route.fulfill({ status: 409, json: {} });
    }
    return route.fulfill({ json: { revision: 6 } });
  });
  await page.goto("/admin/recipe-classification");
  await page.getByRole("tab", { name: "Подборки", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Салат: Для семьи", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Сохранить изменения", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Салат: Для семьи", exact: true }),
  ).toBeChecked();
  await page
    .getByRole("button", { name: "Обновить версию", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Обновить версию", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("checkbox", { name: "Салат: Бюджетно", exact: true }),
  ).toBeChecked();
  await page
    .getByRole("button", { name: "Сохранить изменения", exact: true })
    .click();
  await expect.poll(() => bodies.length).toBe(2);
  expect(bodies[1]).toEqual({
    revision: 5,
    collections: { add: ["family"], remove: [] },
  });
});
test("classification requires editor access", async ({ page }) => {
  await page.route("**/api/admin/recipes", (route) =>
    route.fulfill({ status: 403, json: {} }),
  );
  await page.goto("/admin/recipe-classification");
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Сохранить изменения", exact: true }),
  ).toHaveCount(0);
});
