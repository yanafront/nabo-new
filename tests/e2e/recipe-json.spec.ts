import { test, expect } from "@playwright/test";
import {
  recipeJsonExample,
  parseRecipeJson,
} from "../../shared/recipe/json-editor";
test("JSON: preview, draft creation and protection from duplicate saves", async ({
  page,
}) => {
  await page.route("**/api/admin/recipes", (route) =>
    route.fulfill({ json: { records: [] } }),
  );
  const writes: any[] = [];
  await page.route("**/api/admin/recipes/omlet-s-pomidorami", (route) => {
    writes.push(route.request().postDataJSON());
    return route.fulfill({ json: { revision: 1 } });
  });
  await page.goto("/admin/recipes-json");
  await page.getByRole("button", { name: "Вставить пример" }).click();
  await expect(
    page.getByRole("heading", { name: "Омлет с помидорами" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Сохранить черновик", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Открыть в редакторе" }),
  ).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0].revision).toBe(0);
  expect(writes[0].publish).toBe(false);
  expect(writes[0].document.recipe.ingredients[0].searchQuery).toBe(
    "Яйца куриные",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/tmp/nabo-json-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Создать ещё" }).click();
  await page.getByRole("button", { name: "Вставить пример" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Такой адрес рецепта уже есть" }),
  ).toBeVisible();
  expect(writes).toHaveLength(1);
});
test("JSON upload publishes, while invalid JSON cannot be saved", async ({
  page,
}) => {
  await page.route("**/api/admin/recipes", (route) =>
    route.fulfill({ json: { records: [] } }),
  );
  let payload: any;
  await page.route("**/api/admin/recipes/omlet-s-pomidorami", (route) => {
    payload = route.request().postDataJSON();
    return route.fulfill({ json: { revision: 1 } });
  });
  await page.goto("/admin/recipes-json");
  await page.getByLabel("JSON нового рецепта").fill("{broken");
  await page.getByRole("button", { name: "Проверить и показать" }).click();
  await expect(
    page.getByRole("button", { name: "Создать и опубликовать", exact: true }),
  ).toHaveCount(0);
  page.on("dialog", (dialog) => dialog.accept());
  await page.locator("input[type=file]").setInputFiles({
    name: "new.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(recipeJsonExample)),
  });
  await page
    .getByRole("button", { name: "Создать и опубликовать", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Открыть в редакторе" }),
  ).toBeVisible();
  expect(payload.publish).toBe(true);
  expect(payload.revision).toBe(0);
});
test("deletion needs confirmation and sends the current revision", async ({
  page,
}) => {
  const recipe = {
    ...recipeJsonExample,
    id: "nabo:omlet-s-pomidorami",
    source: "Nabo",
    sourceId: "omlet-s-pomidorami",
    tags: [],
    isActive: true,
    shopabilityScore: 100,
  };
  const doc = { recipe, ingredients: [] };
  await page.route("**/api/admin/recipes", (route) =>
    route.fulfill({
      json: {
        records: [
          { slug: recipe.slug, revision: 5, published: true, document: doc },
        ],
        photosConfigured: false,
      },
    }),
  );
  const deletes: string[] = [];
  await page.route("**/api/admin/recipes/omlet-s-pomidorami?*", (route) => {
    deletes.push(route.request().url());
    return route.fulfill({ status: 204 });
  });
  await page.goto("/admin/recipes");
  await page
    .getByRole("button", {
      name: "Удалить рецепт «Омлет с помидорами»",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Омлет с помидорами");
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  expect(deletes).toHaveLength(0);
  await page
    .getByRole("button", { name: /Омлет с помидорами.*Есть редакция/ })
    .click();
  await page
    .getByRole("button", { name: "Удалить рецепт", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Удалить рецепт", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(deletes[0]).toContain("revision=5");
  await expect(
    page.getByRole("button", { name: /Омлет с помидорами.*Есть редакция/ }),
  ).toHaveCount(0);
});
test("a concurrent create conflict preserves JSON without overwriting a recipe", async ({
  page,
}) => {
  await page.route("**/api/admin/recipes", (route) =>
    route.fulfill({ json: { records: [] } }),
  );
  let writes = 0;
  await page.route("**/api/admin/recipes/omlet-s-pomidorami", (route) => {
    writes++;
    return route.fulfill({ status: 409, json: { message: "Conflict" } });
  });
  await page.goto("/admin/recipes-json");
  await page.getByRole("button", { name: "Вставить пример" }).click();
  await page
    .getByRole("button", { name: "Создать и опубликовать", exact: true })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Существующий рецепт не изменён" }),
  ).toBeVisible();
  await expect(page.getByLabel("JSON нового рецепта")).toHaveValue(
    JSON.stringify(recipeJsonExample, null, 2),
  );
  expect(writes).toBe(1);
});
test("JSON creation is hidden from non-editor accounts", async ({ page }) => {
  await page.route("**/api/admin/recipes", (route) =>
    route.fulfill({ status: 403, json: {} }),
  );
  await page.goto("/admin/recipes-json");
  await expect(
    page.getByRole("alert").filter({ hasText: "нет доступа" }),
  ).toBeVisible();
  await expect(page.getByLabel("JSON нового рецепта")).toHaveCount(0);
});

test("category can change from the list without publishing the recipe draft", async ({
  page,
}) => {
  const doc = parseRecipeJson(JSON.stringify(recipeJsonExample));
  await page.route("**/api/admin/recipes", (route) =>
    route.fulfill({
      json: {
        records: [
          {
            slug: doc.recipe.slug,
            revision: 5,
            published: true,
            document: doc,
          },
        ],
        photosConfigured: false,
      },
    }),
  );
  let payload: any;
  await page.route(
    `**/api/admin/recipes/${doc.recipe.slug}/category`,
    (route) => {
      expect(route.request().method()).toBe("PATCH");
      payload = route.request().postDataJSON();
      return route.fulfill({ json: { revision: 6 } });
    },
  );
  await page.goto("/admin/recipes");
  await page
    .getByRole("button", {
      name: `Изменить категорию «${doc.recipe.title}»`,
      exact: true,
    })
    .click();
  await page
    .getByRole("combobox", { name: "Категория рецепта", exact: true })
    .selectOption("soups");
  await page
    .getByRole("button", { name: "Сохранить категорию", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(payload).toEqual({ categoryId: "soups", revision: 5 });
  await page
    .getByRole("button", { name: new RegExp(doc.recipe.title + ".*Супы") })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Категория", exact: true }),
  ).toHaveValue("soups");
});
