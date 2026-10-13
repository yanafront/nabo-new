import { test, expect } from "@playwright/test";
import { recipeCategories } from "../../shared/recipe/model";
import {
  parseRecipeJson,
  recipeJsonExample,
} from "../../shared/recipe/json-editor";

test("admin creates, renames and safely deletes categories", async ({
  page,
}) => {
  let rows = [{ id: "mains", title: "Основные блюда", revision: 1 }];
  await page.route("**/api/admin/recipe-categories", (r) =>
    r.fulfill({ json: { categories: rows } }),
  );
  await page.route("**/api/admin/recipe-categories/*", (r) => {
    const key = new URL(r.request().url()).pathname.split("/").pop()!;
    if (r.request().method() === "DELETE") {
      if (key === "mains")
        return r.fulfill({
          status: 409,
          json: { message: "Категория используется в рецептах." },
        });
      rows = rows.filter((c) => c.id !== key);
      return r.fulfill({ status: 204 });
    }
    const body = r.request().postDataJSON();
    const existing = rows.find((c) => c.id === key);
    const revision = (existing?.revision || 0) + 1;
    rows = [
      ...rows.filter((c) => c.id !== key),
      { id: key, title: body.title, revision },
    ];
    return r.fulfill({ json: { revision } });
  });
  await page.goto("/admin/categories");
  await page.getByLabel("Название категории", { exact: true }).fill("Закуски");
  await page.getByLabel("Адрес категории", { exact: true }).fill("snacks");
  await page
    .getByRole("button", { name: "Сохранить категорию", exact: true })
    .click();
  await expect(
    page.locator(".category-row").filter({ hasText: "Закуски" }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Изменить категорию «Основные блюда»",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("Адрес категории", { exact: true }),
  ).toHaveAttribute("readonly", "");
  await page
    .getByLabel("Название категории", { exact: true })
    .fill("Основное блюдо");
  await page
    .getByRole("button", { name: "Сохранить категорию", exact: true })
    .click();
  await expect(
    page.locator(".category-row").filter({ hasText: "Основное блюдо" }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Удалить категорию «Основное блюдо»",
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Удалить категорию", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Категория используется" }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Отмена", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Удалить категорию «Закуски»", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Удалить категорию", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.locator(".category-row").filter({ hasText: "Закуски" }),
  ).toHaveCount(0);
});
test("custom category is available in recipe editor and public navigation", async ({
  page,
}) => {
  const categories = [...recipeCategories, { id: "snacks", title: "Закуски" }];
  const doc = parseRecipeJson(JSON.stringify(recipeJsonExample));
  doc.recipe.categoryId = "snacks";
  await page.route("**/api/recipe-categories", (r) =>
    r.fulfill({ json: { categories } }),
  );
  await page.route("**/api/admin/recipes", (r) =>
    r.fulfill({
      json: {
        records: [
          {
            slug: doc.recipe.slug,
            revision: 1,
            published: true,
            document: doc,
          },
        ],
        categories,
      },
    }),
  );
  await page.route("**/api/recipes?**", (r) => {
    const url = new URL(r.request().url());
    return r.fulfill({
      json:
        url.searchParams.get("view") === "categories"
          ? {
              sections: [
                {
                  id: "snacks",
                  title: "Закуски",
                  recipes: [doc.recipe],
                  total: 1,
                },
              ],
            }
          : { recipes: [doc.recipe], total: 1 },
    });
  });
  await page.goto("/admin/recipes");
  await page
    .getByRole("button", { name: /Омлет с помидорами.*Закуски/ })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Категория", exact: true }),
  ).toHaveValue("snacks");
  await page.locator('a[href="/recipes"]:visible').first().click();
  await page.getByRole("link", { name: "Закуски", exact: true }).click();
  await expect(page).toHaveURL(/\/recipes\/category\/snacks$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Закуски");
  await expect(page.locator(".dish-card")).toContainText(doc.recipe.title);
});
