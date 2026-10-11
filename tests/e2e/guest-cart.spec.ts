import { test, expect } from "@playwright/test";
import catalog from "../fixtures/recipes.json" with { type: "json" };
import type { Recipe } from "../../shared/recipe/model";
import { retailStores } from "../../shared/yandex";
const product = {
  id: "milk",
  storeId: "green",
  name: "Молоко 3.2%",
  unit: "1 л",
  price: 3,
  available: true,
  stock: null,
  image: null,
  oldPrice: null,
  placeSlug: "green",
  fetchedAt: new Date().toISOString(),
};
test("guest can add, reload, compare, edit and clear without backend cart or login", async ({
  page,
}) => {
  let cartRequests = 0;
  let comparisons = 0;
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await page.route("**/api/cart**", (route) => {
    cartRequests++;
    return route.fulfill({ status: 401, json: {} });
  });
  await page.route("**/api/search", (route) =>
    route.fulfill({
      json: {
        stores: [
          { storeId: "green", status: "ok", products: [product], total: 1 },
        ],
      },
    }),
  );
  await page.route("**/api/yandex/compare", (route) => {
    comparisons++;
    const items = route.request().postDataJSON().items;
    expect(items[0]).toMatchObject({
      id: "green:milk",
      exactName: product.name,
    });
    return route.fulfill({
      json: {
        offers: retailStores.map((store) => ({
          storeId: store.id,
          placeSlug: store.slug,
          fetchedAt: product.fetchedAt,
          lines: items.map((item: any) => ({
            itemId: item.id,
            query: item.query,
            quantity: item.quantity,
            selected: { ...product, storeId: store.id, id: store.id + "-milk" },
            alternatives: [],
          })),
        })),
      },
    });
  });
  await page.goto("/products?q=Молоко&store=green");
  await page.getByRole("button", { name: "Только необходимые" }).click();
  await page
    .getByRole("button", { name: `Добавить в корзину: ${product.name}` })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(sessionStorage.getItem("nabo-guest-cart-v1") || "{}").items
            ?.length,
      ),
    )
    .toBe(1);
  await expect(page).toHaveURL(/\/products/);
  await page.goto("/basket");
  await expect(page.getByRole("tab")).toHaveCount(6);
  await expect(page.locator(".basket-summary")).toContainText("3,00");
  await page.reload();
  await expect(page.locator(".basket-summary")).toContainText("3,00");
  const before = comparisons;
  await page
    .getByRole("button", { name: `Увеличить количество: ${product.name}` })
    .click();
  await expect(page.locator(".basket-summary")).toContainText("6,00");
  await page.waitForTimeout(500);
  expect(comparisons).toBe(before);
  await page
    .getByRole("button", { name: "Очистить корзину", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Очистить корзину", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "С чего начнём покупки?" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "С чего начнём покупки?" }),
  ).toBeVisible();
  expect(cartRequests).toBe(0);
});

test("guest recipe ingredients use retail search and session cart", async ({
  page,
}) => {
  const recipe = structuredClone(
    catalog.recipes.find((recipe) => recipe.slug === "syrniki")!,
  ) as Recipe;
  recipe.ingredients = [
    {
      ...recipe.ingredients[0],
      searchQuery: "Молоко 3.2%",
      exactName: product.name,
      exactUnit: product.unit,
    },
  ];
  let cartRequests = 0;
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await page.route("**/api/cart**", (route) => {
    cartRequests++;
    return route.fulfill({ status: 401, json: {} });
  });
  await page.route("**/api/recipes/syrniki", (route) =>
    route.fulfill({
      json: { recipe, ingredients: catalog.ingredients },
    }),
  );
  await page.route("**/api/search", (route) =>
    route.fulfill({
      json: {
        stores: [{ storeId: "green", status: "ok", products: [product] }],
      },
    }),
  );
  await page.route("**/api/yandex/compare", (route) =>
    route.fulfill({ json: { offers: [] } }),
  );
  await page.route("**/api/recipes?**", (route) =>
    route.fulfill({
      json: {
        recipes: [recipe],
        total: 1,
        sections: [
          { id: "breakfast", title: "Завтраки", recipes: [recipe], total: 1 },
        ],
      },
    }),
  );
  await page.goto("/products");
  await page
    .getByRole("link", { name: "Рецепты", exact: true })
    .first()
    .click();
  await page.locator('a.dish-card[href="/recipes/syrniki"]').first().click();
  await page.route("**/api/yandex/search/batch", (route) => {
    const body = route.request().postDataJSON();
    return route.fulfill({
      json: {
        items: body.queries.map((query: string) => ({
          query,
          result: {
            storeId: body.storeId,
            status: "ok",
            currency: "BYN",
            products: body.storeId === "green" ? [product] : [],
          },
        })),
      },
    });
  });
  await page
    .getByLabel("Магазин для продуктов рецепта", { exact: true })
    .selectOption("green");
  await page
    .getByRole("button", { name: "Собрать корзину", exact: true })
    .click();
  await page
    .getByRole("button", { name: /Добавить ингредиенты в корзину/ })
    .click();
  await expect(page).toHaveURL(/\/basket$/);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(sessionStorage.getItem("nabo-guest-cart-v1") || "{}")
            .items?.[0]?.product.sourceId,
      ),
    )
    .toBe("milk");
  expect(cartRequests).toBe(0);
});
