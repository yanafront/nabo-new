import { test, expect } from "@playwright/test";

test("shared ingredient query requires confirmation and saves one change for all recipes", async ({
  page,
}) => {
  const id = "a".repeat(64);
  let search = "Яйца",
    revision = 1,
    writes: any[] = [];
  await page.route("**/api/admin/ingredients", (r) =>
    r.fulfill({
      json: {
        items: [
          {
            id,
            name: "Яйца куриные",
            searchQuery: search,
            revision,
            shared: revision > 1,
            usageCount: 2,
            queries: revision > 1 ? [search] : ["Яйца", "Яйца куриные"],
            recipes: [
              { slug: "syrniki", title: "Сырники" },
              { slug: "omelet", title: "Омлет" },
            ],
          },
        ],
      },
    }),
  );
  await page.route(`**/api/admin/ingredients/${id}`, (r) => {
    writes.push(r.request().postDataJSON());
    search = writes.at(-1).searchQuery;
    revision++;
    return r.fulfill({ json: { revision, affectedRecipes: 2 } });
  });
  await page.goto("/admin/ingredients");
  await expect(page.locator(".ingredient-row")).toHaveCount(1);
  await page
    .getByRole("button", {
      name: "Изменить поисковое название «Яйца куриные»",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Поисковое название", { exact: true })
    .fill("Яйца куриные С1");
  await page
    .getByRole("button", { name: "Сохранить для всех рецептов", exact: true })
    .click();
  expect(writes).toHaveLength(0);
  await expect(page.getByRole("dialog")).toContainText(
    "во всех связанных рецептах",
  );
  await page
    .getByRole("button", { name: "Подтвердить изменение", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(writes).toEqual([{ searchQuery: "Яйца куриные С1", revision: 1 }]);
  await expect(page.locator(".ingredient-query")).toContainText(
    "Яйца куриные С1",
  );
  await page.getByLabel("Найти ингредиент", { exact: true }).fill("молоко");
  await expect(page.locator(".ingredient-row")).toHaveCount(0);
});

test("ingredient registry is unavailable to non-editors", async ({ page }) => {
  await page.route("**/api/admin/ingredients", (r) =>
    r.fulfill({ status: 403, json: {} }),
  );
  await page.goto("/admin/ingredients");
  await expect(
    page.getByRole("alert").filter({ hasText: "Нет доступа" }),
  ).toBeVisible();
  await expect(page.locator(".ingredient-row")).toHaveCount(0);
});
