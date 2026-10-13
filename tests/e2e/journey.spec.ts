import { test, expect } from "@playwright/test";
import fixture from "../fixtures/yandex-search.json" with { type: "json" };
import catalog from "../fixtures/recipes.json" with { type: "json" };
import { normalizeSearch } from "../../server/utils/yandex-schema";
import { retailStores } from "../../shared/yandex";
const recipe = {
  ...catalog.recipes.find((r) => r.slug === "syrniki")!,
  image: undefined,
};
test.beforeEach(async ({ page }) => {
  await page.route("**/api/auth/me", (r) =>
    r.fulfill({ status: 401, json: {} }),
  );
  await page.route("**/api/recipes**", (r) => {
    const url = new URL(r.request().url());
    return r.fulfill({
      json: url.pathname.endsWith("/syrniki")
        ? { recipe, ingredients: catalog.ingredients }
        : url.searchParams.get("view") === "categories"
          ? {
              sections: [
                {
                  id: "mains",
                  title: "Основные блюда",
                  recipes: [recipe],
                  total: 1,
                },
              ],
            }
          : { recipes: [recipe], total: 1 },
    });
  });
  await page.route("**/api/dining/search?*", (r) =>
    r.fulfill({ json: { offers: [] } }),
  );
  await page.route("**/api/yandex/search/batch", (r) => {
    const b = r.request().postDataJSON();
    return r.fulfill({
      json: {
        items: b.queries.map((q: string, i: number) => ({
          query: q,
          result: {
            status: "ok",
            storeId: b.storeId,
            products: [
              {
                id: `ingredient-${i}`,
                storeId: b.storeId,
                placeSlug: b.storeId,
                name: q,
                unit: "1 кг",
                price: 2,
                oldPrice: null,
                image: null,
                stock: null,
                available: true,
                fetchedAt: "",
              },
            ],
          },
        })),
      },
    });
  });
  await page.route("**/api/search", (r) =>
    r.fulfill({
      json: {
        stores: retailStores.map((s) => ({
          storeId: s.id,
          status: "ok",
          products: normalizeSearch(
            fixture,
            s.id,
            s.slug,
            "2026-10-01T00:00:00Z",
          ),
        })),
      },
    }),
  );
  await page.route("**/api/yandex/search", (r) => {
    const b = r.request().postDataJSON();
    return r.fulfill({
      json: {
        storeId: b.storeId,
        status: "ok",
        products: normalizeSearch(
          fixture,
          b.storeId,
          b.storeId,
          "2026-10-01T00:00:00Z",
        ),
      },
    });
  });
  await page.route("**/api/product", (r) => {
    const b = r.request().postDataJSON(),
      products = normalizeSearch(
        fixture,
        b.storeId,
        b.storeId,
        "2026-10-01T00:00:00Z",
      );
    return r.fulfill({
      json: {
        status: "ok",
        product: products.find((p) => p.id === b.id) || products[0],
      },
    });
  });
  await page.route("**/api/yandex/compare", (r) => {
    const b = r.request().postDataJSON();
    return r.fulfill({
      json: {
        offers: retailStores.map((s) => ({
          storeId: s.id,
          placeSlug: s.slug,
          fetchedAt: "2026-10-01T00:00:00Z",
          lines: b.items.map((item: any) => ({
            itemId: item.id,
            query: item.query,
            quantity: item.quantity,
            selected: normalizeSearch(
              fixture,
              s.id,
              s.slug,
              "2026-10-01T00:00:00Z",
            )[0],
            alternatives: [],
          })),
        })),
      },
    });
  });
});
async function cookies(page: any) {
  const consent = page.getByRole("button", {
    name: "Только необходимые",
    exact: true,
  });
  if (await consent.isVisible()) await consent.click();
}
test("рецепты → блюдо → ингредиенты → гостевая корзина", async ({ page }) => {
  await page.goto("/recipes?q=сырники");
  await cookies(page);
  const retry = page
    .locator("main")
    .getByRole("button", { name: "Повторить", exact: true });
  if (await retry.first().isVisible()) await retry.first().click();
  await page
    .getByRole("link", { name: /Сырники/ })
    .first()
    .click();
  if (await retry.first().isVisible()) await retry.first().click();
  await expect(
    page.getByRole("heading", { name: "Сырники", exact: true, level: 1 }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Собрать корзину", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Добавить ингредиенты в корзину",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/basket$/);
  await expect(page.locator(".basket-context")).toContainText("Сырники");
  await expect(page.locator(".product-row").first()).toBeVisible();
});
test("товары → поиск → карточка в модалке → возврат без навигации", async ({
  page,
}) => {
  await page.goto("/products?q=молоко");
  await cookies(page);
  const card = page.locator(".catalog-product-link").first();
  await expect(card).toBeVisible();
  const href = page.url();
  await card.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByRole("heading", { level: 1 }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Закрыть", exact: true })
    .click();
  await expect(page).toHaveURL(href);
  await expect(card).toBeVisible();
});
test("ручной выбор товара сохраняется в гостевой корзине после обновления", async ({
  page,
}) => {
  await page.goto("/products?q=молоко");
  await cookies(page);
  await page
    .locator(".catalog-product-card")
    .first()
    .getByRole("button", { name: /^Добавить в корзину:/ })
    .click();
  await page.goto("/basket");
  await expect(page.locator(".product-row").first()).toBeVisible();
  await page.reload();
  await expect(page.locator(".product-row").first()).toBeVisible();
});
