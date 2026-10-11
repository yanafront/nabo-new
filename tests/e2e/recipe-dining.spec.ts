import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const seed = JSON.parse(
  readFileSync(new URL("../fixtures/recipes.json", import.meta.url), "utf8"),
);
const recipe = seed.recipes.find((r: any) => r.slug === "syrniki");
test.beforeEach(async ({ page }) => {
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
            products: [
              {
                id: query,
                name: query,
                unit: "100 г",
                price: 2,
                available: true,
                stock: null,
                storeId: body.storeId,
                placeSlug: body.storeId,
                fetchedAt: "2026-10-11",
              },
            ],
          },
        })),
      },
    });
  });
  await page.route("**/api/recipes/syrniki", (route) =>
    route.fulfill({ json: { recipe, ingredients: seed.ingredients } }),
  );
});
test("restaurant offers show portions, prices and external links without changing servings", async ({
  page,
}) => {
  let requests = 0;
  await page.route("https://cdn.delivio.by/test-*.jpg", (route) => {
    if (route.request().url().includes("broken"))
      return route.fulfill({ status: 404 });
    const height = route.request().url().includes("tall") ? 600 : 50;
    return route.fulfill({
      contentType: "image/svg+xml",
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="${height}"><rect width="200" height="${height}" fill="#f1e4d2"/></svg>`,
    });
  });
  await page.route("**/api/dining/search?*", (route) => {
    requests++;
    expect(new URL(route.request().url()).searchParams.get("q")).toBe(
      recipe.title,
    );
    return route.fulfill({
      json: {
        offers: [
          {
            image: "https://cdn.delivio.by/test-wide.jpg",
            id: "1",
            name: "Сырники",
            restaurant: "Кафе",
            price: 9,
            portion: "180 г",
            available: true,
            url: "https://delivio.by/restaurant/cafe",
          },
          {
            id: "2",
            name: "Сырники с ягодами, сметаной и очень длинным названием",
            restaurant: "Кафе с длинным названием на улице Победителей",
            price: 12,
            portion: "250 г",
            available: true,
            url: "https://delivio.by/restaurant/second",
            image: "https://cdn.delivio.by/test-tall.jpg",
          },
          {
            id: "3",
            name: "Сырники",
            restaurant: "Без фото",
            price: 14,
            portion: "200 г",
            available: true,
            url: "https://delivio.by/restaurant/third",
            image: "https://cdn.delivio.by/test-broken.jpg",
          },
          {
            id: "4",
            name: "Сырники с джемом",
            restaurant: "Завтраки",
            price: 15,
            portion: "210 г",
            available: false,
            url: "https://delivio.by/restaurant/fourth",
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
  await expect(block.getByText("Кафе", { exact: true }).first()).toBeVisible();
  await expect(block.getByText("180 г", { exact: true }).first()).toBeVisible();
  await expect(
    block.getByRole("link", { name: "Открыть Кафе в Delivio" }),
  ).toHaveAttribute("href", "https://delivio.by/restaurant/cafe");
  const assemble = page.getByRole("button", {
    name: "Собрать корзину",
    exact: true,
  });
  await assemble.click();
  const drawer = page.getByRole("dialog", {
    name: "Продукты для корзины",
    exact: true,
  });
  await expect(drawer).toBeVisible();
  await expect(
    drawer.getByRole("button", {
      name: "Добавить ингредиенты в корзину",
      exact: true,
    }),
  ).toBeInViewport();
  await expect
    .poll(async () => {
      const bounds = await drawer.boundingBox();
      return Math.round(bounds!.x + bounds!.width);
    })
    .toBe(page.viewportSize()!.width);
  await drawer.screenshot({
    path: `/tmp/nabo-ingredients-drawer-${test.info().project.name}.png`,
  });
  await page
    .getByRole("button", { name: "Увеличить порции", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(assemble).toBeFocused();
  await expect(page.locator(".composition-servings")).toHaveText("На 3 порции");
  await assemble.click();
  await expect(page.locator(".serving-control output")).toHaveText("3 порц.");
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  expect(requests).toBe(1);
  await expect(block.getByText("от 9,00 BYN")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await block.locator(".dining-card").last().scrollIntoViewIfNeeded();
  await expect(block.locator(".dining-card")).toHaveCount(4);
  await expect(block.locator(".dining-image-placeholder")).toHaveCount(2);
  const dimensions = await block
    .locator(".dining-image")
    .evaluateAll((elements) =>
      elements.map((el) => ({
        width: el.getBoundingClientRect().width,
        height: el.getBoundingClientRect().height,
      })),
    );
  expect(
    Math.max(...dimensions.map((d) => d.height)) -
      Math.min(...dimensions.map((d) => d.height)),
  ).toBeLessThan(1);
  const columns = await block
    .locator(".dining-offers")
    .evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
    );
  expect(columns).toBe(test.info().project.name === "mobile" ? 2 : 4);
  const cookSummary = await block.locator(".cook-summary").boundingBox();
  const diningSummary = await block.locator(".dining-heading").boundingBox();
  if (test.info().project.name === "mobile")
    expect(diningSummary!.y).toBeGreaterThanOrEqual(
      cookSummary!.y + cookSummary!.height,
    );
  else expect(Math.abs(cookSummary!.y - diningSummary!.y)).toBeLessThan(1);
  await expect(block.locator(".cook-price")).toContainText("BYN");
  await expect(
    page.getByRole("button", {
      name: "Собрать корзину",
      exact: true,
    }),
  ).toBeEnabled();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(
    block.getByRole("link", { name: "Заказать готовое", exact: true }),
  ).toHaveAttribute("href", "#recipe-ready-offers");
  await expect(
    page.getByRole("heading", { name: "Как приготовить", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".recipe-instructions ol li").first(),
  ).toBeVisible();
  const cover = await page.locator(".recipe-cover").boundingBox();
  const image = await page.locator(".recipe-cover img").boundingBox();
  expect(Math.abs(cover!.height - image!.height)).toBeLessThan(1);
  await page.screenshot({
    path: `/tmp/nabo-recipe-after-${test.info().project.name}.png`,
    fullPage: true,
  });
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
      name: "Собрать корзину",
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

test("batch price follows store and servings and adds the same products without another search", async ({
  page,
}) => {
  const pricedRecipe = {
    ...recipe,
    servings: 2,
    ingredients: [
      {
        ...recipe.ingredients[0],
        quantity: 500,
        unit: "g",
        searchQuery: "Творог точный запрос",
        exactName: "Творог выбранный",
        exactUnit: "",
      },
    ],
  };
  await page.route("**/api/recipes/syrniki", (route) =>
    route.fulfill({
      json: { recipe: pricedRecipe, ingredients: seed.ingredients },
    }),
  );
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  let cartCalls = 0,
    searches = 0;
  const batches: any[] = [];
  await page.route("**/api/cart**", (route) => {
    cartCalls++;
    return route.fulfill({ status: 401, json: {} });
  });
  await page.route("**/api/search", (route) => {
    searches++;
    return route.fulfill({ json: { stores: [] } });
  });
  await page.route("**/api/yandex/compare", (route) =>
    route.fulfill({ json: { offers: [] } }),
  );
  await page.route("**/api/dining/search?*", (route) =>
    route.fulfill({ json: { offers: [] } }),
  );
  await page.route("**/api/yandex/search/batch", (route) => {
    const body = route.request().postDataJSON();
    batches.push(body);
    const green = body.storeId === "green";
    return route.fulfill({
      json: {
        items: body.queries.map((query: string) => ({
          query,
          result: {
            storeId: body.storeId,
            status: "ok",
            currency: "BYN",
            products: [
              {
                id: "curd",
                name: "Творог выбранный",
                storeId: body.storeId,
                unit: green ? "250 г" : "200 г",
                price: green ? 4 : 3,
                stock: null,
                available: true,
                fetchedAt: "",
                placeSlug: body.storeId,
              },
            ],
          },
        })),
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
  await expect(page.locator(".cook-price")).toHaveText("9,00 BYN");
  expect(batches[0]).toMatchObject({
    storeId: "evroopt",
    queries: ["Творог точный запрос"],
    location: { lat: 53.9, lon: 27.5667 },
  });
  expect(cartCalls).toBe(0);
  await page
    .getByRole("button", { name: "Собрать корзину", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Уменьшить порции", exact: true })
    .click();
  await expect(page.locator(".drawer-price")).toContainText("6,00 BYN");
  expect(batches).toHaveLength(1);
  await page
    .getByLabel("Магазин для сборки корзины", { exact: true })
    .selectOption("green");
  await expect(page.locator(".drawer-price")).toContainText("4,00 BYN");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Закрыть", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Посмотреть товары", exact: true })
    .click();
  const found = page.getByRole("dialog");
  await expect(found).toHaveAccessibleName("Продукты · Green");
  await expect(found.locator(".found-product-info")).toContainText(
    "Творог выбранный",
  );
  await expect(found.locator(".found-product-info")).toContainText(
    "1 уп. × 4,00 BYN",
  );
  await expect(found.locator(".found-products-total")).toContainText(
    "4,00 BYN",
  );
  expect(batches).toHaveLength(2);
  const overflows = await found.evaluate(
    (el) => el.scrollWidth > el.clientWidth,
  );
  expect(overflows).toBe(false);
  await found
    .getByRole("button", { name: "Добавить товары в корзину", exact: true })
    .click();
  await expect(page).toHaveURL(/\/basket$/);
  const saved = await page.evaluate(
    () =>
      JSON.parse(sessionStorage.getItem("nabo-guest-cart-v1") || "{}").items,
  );
  expect(saved[0]).toMatchObject({
    quantity: 1,
    product: { sourceId: "curd", storeId: "green", price: 4 },
  });
  expect(batches).toHaveLength(2);
  expect(searches).toBe(0);
  expect(cartCalls).toBe(0);
});
