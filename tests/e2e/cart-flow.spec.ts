import { test, expect } from "@playwright/test";
import type { Recipe } from "../../shared/recipe/model";
import catalog from "../fixtures/recipes.json" with { type: "json" };
const product = {
  id: "curd-123",
  storeId: "green",
  name: "Творог Савушкин 5% 200 г",
  unit: "200 г",
  price: 3,
  available: true,
  stock: null,
  image: null,
  oldPrice: null,
  placeSlug: "green",
  fetchedAt: new Date().toISOString(),
};
test("recipe → saveCart/getCart → comparison from saved cart → clear", async ({
  page,
}) => {
  let items: any[] = [];
  const writes: any[][] = [];
  let compareCalls = 0;
  const searches: string[] = [];
  const compareInputs: any[] = [];
  const events: string[] = [];
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { id: "user", phoneNumber: "+375291234567" } }),
  );
  await page.route("**/api/cart**", (route) => {
    if (route.request().method() === "POST") {
      events.push("save");
      items = route.request().postDataJSON().items;
      writes.push(items);
      return route.fulfill({ json: true });
    }
    events.push("get");
    return route.fulfill({
      json: {
        phone: "+375291234567",
        items: items.map((item) => ({
          ...item,
          current: {
            storeId: item.storeId,
            id: item.id,
            status: "ok",
            product,
            fetchedAt: product.fetchedAt,
          },
        })),
      },
    });
  });
  await page.route("**/api/search", (route) => {
    searches.push(route.request().postDataJSON().query);
    return route.fulfill({
      json: {
        stores: [{ storeId: "green", status: "ok", products: [product] }],
      },
    });
  });
  await page.route("**/api/yandex/compare", (route) => {
    events.push("compare");
    compareInputs.push(route.request().postDataJSON());
    compareCalls++;
    return route.fulfill({ json: { offers: [] } });
  });
  await page.route("**/api/recipes?**", (route) =>
    route.fulfill({
      json: {
        recipes: catalog.recipes,
        total: catalog.recipes.length,
        sections: [
          {
            id: "breakfast",
            title: "Завтраки",
            recipes: catalog.recipes,
            total: catalog.recipes.length,
          },
        ],
      },
    }),
  );
  await page.route("**/api/recipes/syrniki", (route) => {
    const recipe = structuredClone(
      catalog.recipes.find((recipe) => recipe.slug === "syrniki")!,
    ) as Recipe;
    recipe.ingredients = [
      {
        ...recipe.ingredients[0],
        searchQuery: "Творог 5%",
        exactName: product.name,
        exactUnit: product.unit,
      },
    ];
    return route.fulfill({
      json: { recipe, ingredients: catalog.ingredients },
    });
  });
  await page.goto("/basket");
  await page.getByRole("link", { name: "Выбрать рецепт", exact: true }).click();
  await page.locator('a.dish-card[href="/recipes/syrniki"]').first().click();
  await expect(
    page.getByRole("heading", { name: "Сырники", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.readyState))
    .toBe("complete");
  await page
    .getByRole("button", { name: /Добавить ингредиенты в корзину/ })
    .click();
  await expect(page).toHaveURL(/\/basket$/);
  await expect.poll(() => writes.length).toBeGreaterThan(0);
  expect(searches).toEqual(["Творог 5%"]);
  expect(writes[0][0]).toMatchObject({
    id: product.id,
    storeId: "green",
    count: 1,
  });
  await page
    .getByRole("button", { name: `Увеличить количество: ${product.name}` })
    .click();
  await expect.poll(() => writes.at(-1)?.[0]?.count).toBe(2);
  expect(compareCalls).toBe(0);
  await page.getByRole("link", { name: /Сравнить в магазинах/ }).click();
  await expect.poll(() => compareCalls).toBeGreaterThan(0);
  expect(compareInputs[0].items).toEqual([
    {
      id: "green:curd-123",
      query: product.name,
      exactName: product.name,
      quantity: 2,
      unit: product.unit,
    },
  ]);
  const comparedAt = events.indexOf("compare");
  expect(events[comparedAt - 1]).toBe("get");
  expect(events.indexOf("save")).toBeLessThan(comparedAt);
  await page.goBack();
  await expect(page).toHaveURL(/\/basket$/);
  await page
    .getByRole("button", { name: "Очистить корзину", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Очистить корзину", exact: true })
    .click();
  await expect.poll(() => writes.at(-1)?.length).toBe(0);
});

test("catalog selection stays manual and the selected SKU survives a reload", async ({
  page,
}) => {
  let items: any[] = [];
  const writes: any[][] = [];
  let compareCalls = 0;
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { id: "user" } }),
  );
  await page.route("**/api/cart**", (route) => {
    if (route.request().method() === "POST") {
      items = route.request().postDataJSON().items;
      writes.push(items);
      return route.fulfill({ json: true });
    }
    return route.fulfill({
      json: {
        items: items.map((item) => ({
          ...item,
          current: {
            id: item.id,
            storeId: item.storeId,
            status: "ok",
            product,
            fetchedAt: product.fetchedAt,
          },
        })),
      },
    });
  });
  await page.route("**/api/search", (route) =>
    route.fulfill({
      json: {
        stores: [{ storeId: "green", status: "ok", products: [product] }],
      },
    }),
  );
  await page.route("**/api/yandex/compare", (route) => {
    compareCalls++;
    return route.fulfill({ json: { offers: [] } });
  });
  await page.goto("/products");
  await page
    .getByRole("textbox", { name: "Поиск товаров", exact: true })
    .fill("Творог");
  await page.locator('.catalog-search button[type="submit"]').click();
  await page.getByRole("tab", { name: /Green/ }).click();
  await expect(page.locator(".catalog-product-card")).toHaveCount(1);
  expect(writes).toHaveLength(0);
  await page
    .getByRole("button", { name: `Добавить в корзину: ${product.name}` })
    .click();
  await expect.poll(() => writes.length).toBe(1);
  expect(items[0]).toMatchObject({
    id: product.id,
    storeId: "green",
    count: 1,
  });
  await page.goto("/basket");
  await expect(page.locator(".product-row h3")).toHaveText(product.name);
  expect(compareCalls).toBe(0);
});
