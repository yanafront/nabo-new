import { test, expect } from "@playwright/test";
import fixture from "../fixtures/yandex-search.json" with { type: "json" };
import { normalizeSearch } from "../../server/utils/yandex-schema";
import { retailStores } from "../../shared/yandex";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/recipes**", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q") || "";
    await route.fulfill({
      json: {
        total: 501,
        recipes: query.toLowerCase().includes("драник")
          ? [
              {
                slug: "draniki",
                name: "Драники",
                summary: "Белорусские картофельные оладьи",
                country: "BY",
                servings: Number(query.match(/\d+/)?.[0]) || 4,
                minutes: 35,
                image: null,
                ingredients: [
                  { id: "potato", name: "Картофель", amount: "1 кг" },
                  { id: "onion", name: "Лук репчатый", amount: "1 шт" },
                ],
              },
            ]
          : [],
      },
    });
  });
  await page.route("**/api/yandex/search", async (route) => {
    const body = route.request().postDataJSON();
    const products = normalizeSearch(
      fixture,
      body.storeId,
      body.storeId,
      new Date().toISOString(),
    );
    await route.fulfill({
      json: {
        status: "ok",
        storeId: body.storeId,
        placeSlug: body.storeId,
        products,
        currency: "BYN",
        fetchedAt: new Date().toISOString(),
      },
    });
  });
  await page.route("**/api/yandex/compare", async (route) => {
    const body = route.request().postDataJSON();
    const offers = retailStores.map((s, index) => {
      const products = normalizeSearch(
        fixture,
        s.id,
        s.slug,
        new Date().toISOString(),
      );
      return {
        storeId: s.id,
        placeSlug: s.slug,
        fetchedAt: new Date().toISOString(),
        lines: body.items.map((item: any) => ({
          itemId: item.id,
          query: item.query,
          quantity: item.quantity,
          selected: index === 3 ? null : products[0],
          alternatives: products,
          ...(index === 3
            ? { error: "Яндекс не ответил вовремя. Повторите поиск." }
            : {}),
        })),
      };
    });
    await route.fulfill({
      json: { offers, source: "yandex-eda", delivery: null },
    });
  });
});

test("находит рецепт из большой базы и собирает корзину", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Что хотите купить или приготовить" })
    .fill("драники на 4");
  await expect(page.getByRole("option", { name: /Драники/ })).toBeVisible();
  await page.getByRole("option", { name: /Драники/ }).click();
  await expect(page).toHaveURL(/basket/);
  await expect(page.getByRole("heading", { name: /Драники/ })).toBeVisible();
  await expect(page.locator(".product-row")).toHaveCount(1);
});

test("каталог магазина → карточка товара → сравнение с другими магазинами", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Магазины", exact: true }).click();
  await page.getByRole("link", { name: /Евроопт/ }).click();
  await expect(page.getByRole("heading", { name: "Евроопт" })).toBeVisible();
  await expect(page.locator(".catalog-product-card")).toHaveCount(3);
  await page.locator(".catalog-product-link").first().click();
  await expect(page).toHaveURL(/\/product\/evroopt\//);
  await expect(page.locator(".product-detail h1")).toContainText("Молоко");
  await expect(page.locator(".similar-store-group")).toHaveCount(
    retailStores.length - 1,
  );
  await page.locator(".product-buy-row button").click();
  await expect(page.locator(".product-buy-row button")).toContainText(
    "1 в корзине",
  );
});
test("товар из Яндекса → корзина → сравнение → сохранение", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Добавить продукты вручную", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Поиск продукта" }).fill("молоко");
  await expect(page.locator(".picker-product")).toHaveCount(3);
  await page.locator(".picker-product").first().click();
  await expect(
    page.locator('.picker-cart-footer [role="status"]'),
  ).toContainText("в корзине 1");
  await expect(page.locator(".in-cart-badge").first()).toContainText("1");
  await page.getByRole("button", { name: /Перейти в корзину/ }).click();
  await expect(page).toHaveURL(/basket/);
  await expect(page.locator(".product-row")).toHaveCount(1);
  await expect(page.locator(".row-price")).toContainText("2,35");
  await page.getByRole("button", { name: /Увеличить количество/ }).click();
  await expect(page.locator(".quantity span")).toHaveText("2");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await page.getByRole("link", { name: "Найти дешевле" }).click();
  await expect(page.locator(".offer")).toHaveCount(5);
  await expect(
    page.locator(".offer").filter({ hasText: "Не удалось проверить" }),
  ).toHaveCount(1);
  await expect(
    page.locator(".offer").filter({ hasText: "Не удалось проверить" }),
  ).toContainText("Не удалось проверить");
  await page.getByRole("checkbox").check();
  await expect(page.locator(".offer")).toHaveCount(4);
  await page
    .locator(".offer")
    .first()
    .getByRole("button", { name: "Посмотреть" })
    .click();
  await expect(page.getByRole("dialog").locator("select")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Заменить товар", exact: true })
    .first()
    .click();
  await page.locator(".replacement-option").first().click();
  await expect(page.locator(".replacement-options")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toContainText(
    "Корзина автоматически не переносится",
  );
  await expect(page.getByRole("link", { name: /Перейти в / })).toHaveAttribute(
    "href",
    /https:\/\/(eda.yandex.by\/retail\/|sosedi-dostavka.by)/,
  );
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await page.goto("/saved");
  await expect(page.locator(".saved-card")).toHaveCount(1);
  await page.reload();
  await page.getByRole("button", { name: "Повторить покупки" }).click();
  await expect(page.locator(".product-row")).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("ошибка Яндекса не подменяется моковыми ценами", async ({ page }) => {
  await page.route("**/api/yandex/search", (route) =>
    route.fulfill({
      json: {
        storeId: "evroopt",
        placeSlug: "evroopt",
        status: "error",
        products: [],
        error: "Яндекс не ответил вовремя",
        currency: "BYN",
        fetchedAt: new Date().toISOString(),
      },
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Добавить продукты вручную", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Поиск продукта" }).fill("молоко");
  await expect(page.getByRole("alert")).toContainText("Яндекс не ответил");
  await expect(page.locator(".picker-product")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Повторить" })).toBeVisible();
});
test("рецепт добавляет реальные товары вместо ингредиентов-заготовок", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Борщ на 5 человек", exact: true })
    .click();
  await expect(page).toHaveURL(/basket/);
  await expect(page.locator(".product-row")).toHaveCount(1); // fixture repeats one upstream SKU; duplicate packs merge
  await expect(page.locator(".product-name h3")).toContainText("Савушкин");
  await expect(page.locator(".row-price")).not.toContainText("—");
  await page.getByRole("button", { name: "Пожелания" }).click();
  await expect(page.locator(".row-options a")).toHaveAttribute(
    "href",
    /(item=|sosedi-dostavka.by)/,
  );
});
test("минус уменьшает количество и удаляет последнюю упаковку", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Добавить продукты вручную", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Поиск продукта" }).fill("молоко");
  await page.locator(".picker-product").first().click();
  await page.locator(".picker-product").first().click();
  await expect(
    page.locator('.picker-cart-footer [role="status"]'),
  ).toContainText("в корзине 2");
  await page.getByRole("button", { name: /Перейти в корзину/ }).click();
  await page.getByRole("button", { name: /Уменьшить количество/ }).click();
  await expect(page.locator(".quantity span")).toHaveText("1");
  await page.getByRole("button", { name: /Уменьшить количество/ }).click();
  await expect(page.locator(".product-row")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "С чего начнём покупки?" }),
  ).toBeVisible();
});
test("при сбое рецепта текущая корзина сохраняется", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Добавить продукты вручную", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Поиск продукта" }).fill("молоко");
  await page.locator(".picker-product").first().click();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await page.route("**/api/yandex/compare", (route) =>
    route.fulfill({ json: { offers: [] } }),
  );
  await page
    .getByRole("button", { name: "Борщ на 5 человек", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Не удалось подобрать");
  await page.goto("/basket");
  await expect(page.locator(".product-row")).toHaveCount(1);
});

test("карточка товара доступна при сбое остальных магазинов", async ({
  page,
}) => {
  const products = normalizeSearch(
    fixture,
    "evroopt",
    "evroopt",
    new Date().toISOString(),
  );
  await page.route("**/api/yandex/search", async (route) => {
    if (route.request().postDataJSON().storeId !== "evroopt")
      return route.abort();
    return route.fallback();
  });
  await page.goto(
    `/product/evroopt/${products[0].id}?name=${encodeURIComponent(products[0].name)}`,
  );
  await expect(page.locator(".product-detail h1")).toHaveText(products[0].name);
  await expect(page.locator(".product-buy-row button")).toBeEnabled();
});
