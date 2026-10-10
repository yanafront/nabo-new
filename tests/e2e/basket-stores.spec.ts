import { test, expect } from "@playwright/test";
import { retailStores, type StoreId } from "../../shared/yandex";
const longName =
  "Молоко питьевое стерилизованное с добавлением витаминов, натуральное цельное, для всей семьи в удобной упаковке 1 л";
const source = (storeId: StoreId, id: string, name: string, price: number) => ({
  storeId,
  id,
  name,
  price,
  unit: "1 л",
  available: true,
  stock: null,
  oldPrice: null,
  image: null,
  placeSlug: storeId,
  fetchedAt: new Date().toISOString(),
});
async function mockCart(page: import("@playwright/test").Page, stale = false) {
  let cart = [
    { storeId: "green", id: "milk", name: longName, count: 1, unit: "1 л" },
    {
      storeId: "green",
      id: "avocado",
      name: "Авокадо",
      count: 1,
      unit: "1 уп.",
    },
  ];
  const writes: any[] = [];
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { id: "user" } }),
  );
  await page.route("**/api/cart**", (route) => {
    if (route.request().method() === "POST") {
      cart = route.request().postDataJSON().items;
      writes.push(cart);
      return route.fulfill({ json: true });
    }
    return route.fulfill({
      json: {
        items: cart.map((item) => ({
          ...item,
          current: {
            id: item.id,
            storeId: item.storeId,
            status: "ok",
            product: source(item.storeId as StoreId, item.id, item.name, 5),
            fetchedAt: new Date().toISOString(),
          },
        })),
      },
    });
  });
  await page.route("**/api/yandex/compare", (route) => {
    const input = route.request().postDataJSON().items;
    return route.fulfill({
      json: {
        offers: retailStores.map((store) => ({
          storeId: store.id,
          placeSlug: store.slug,
          fetchedAt: stale
            ? "2020-01-01T00:00:00.000Z"
            : new Date().toISOString(),
          lines: input.map((item: any, index: number) => ({
            itemId: item.id,
            query: item.query,
            quantity: item.quantity,
            selected:
              store.id === "evroopt" && index === 1
                ? null
                : source(
                    store.id,
                    `${store.id}-${item.id}`,
                    item.query,
                    store.id === "evroopt"
                      ? 1
                      : store.id === "sosedi"
                        ? 3 + index
                        : 5 + index,
                  ),
            alternatives: [
              source(
                store.id,
                "alternative",
                longName + " · другой производитель",
                6,
              ),
            ],
          })),
        })),
      },
    });
  });
  return writes;
}
test("six store tabs show store totals, best full basket and inline replacements without a modal", async ({
  page,
}, testInfo) => {
  const writes = await mockCart(page);
  await page.goto("/basket");
  await expect(page.getByRole("tab")).toHaveCount(6);
  await expect(page.locator(".basket-benefit")).toContainText(
    "Соседи · 7,00 BYN",
  );
  await expect(page.getByRole("tab", { name: /Соседи/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator(".basket-summary")).toContainText("7,00");
  await page.getByRole("tab", { name: /Евроопт/ }).click();
  await expect(page.locator(".basket-summary")).toContainText(
    "За найденные товары",
  );
  await expect(page.locator(".store-missing-row")).toContainText("Авокадо");
  await expect(page.locator(".basket-benefit")).toContainText(
    "Соседи · 7,00 BYN",
  );
  await page.getByRole("tab", { name: /Green/ }).click();
  await page
    .getByRole("button", { name: `Заменить: ${longName}`, exact: true })
    .click();
  await expect(page.locator(".store-replacements")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/tmp/nabo-basket-stores-${testInfo.project.name}.png`,
  });
  await page.locator(".store-replacement").first().click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toHaveLength(2);
  expect(
    writes[0].find((item: any) => item.id === "alternative"),
  ).toMatchObject({ storeId: "green", count: 1 });
  await expect(page.locator(".basket-summary a")).toHaveAttribute(
    "href",
    "https://green-dostavka.by/",
  );
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(page).toHaveURL(/\/basket$/);
  await page.getByRole("tab", { name: /Green/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /Гиппо/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});
test("old compare URL redirects into the basket", async ({ page }) => {
  await mockCart(page);
  await page.goto("/compare");
  await expect(page).toHaveURL(/\/basket$/);
  await expect(page.getByRole("tab")).toHaveCount(6);
});

test("unchanged basket does not poll when backend comparison timestamps are old", async ({
  page,
}) => {
  await mockCart(page, true);
  let reads = 0,
    comparisons = 0;
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname === "/api/cart" &&
      request.method() === "GET"
    )
      reads++;
    if (new URL(request.url()).pathname === "/api/yandex/compare")
      comparisons++;
  });
  await page.goto("/basket");
  await expect(page.locator(".basket-benefit")).toContainText(
    "Соседи · 7,00 BYN",
  );
  const count = reads;
  await page.waitForTimeout(1800);
  expect(reads).toBe(count);
  expect(comparisons).toBe(1);
  await page.getByRole("button", { name: "Обновить", exact: true }).click();
  await expect.poll(() => comparisons).toBe(2);
  expect(reads).toBe(count + 1);
});

test("failed automatic comparison waits for explicit retry instead of polling", async ({
  page,
}) => {
  await mockCart(page);
  let attempts = 0;
  await page.route("**/api/yandex/compare", (route) => {
    attempts++;
    return route.fulfill({ status: 502, json: { message: "Unavailable" } });
  });
  await page.goto("/basket");
  await expect(
    page.getByRole("button", { name: "Повторить", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(1800);
  expect(attempts).toBe(1);
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect.poll(() => attempts).toBe(2);
});

test("editing stays visible while saving and refreshing comparison in the background", async ({
  page,
}) => {
  await mockCart(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/cart**", async (route) => {
    if (route.request().method() === "POST") await gate;
    await route.fallback();
  });
  await page.goto("/basket");
  await expect(page.locator(".basket-summary")).toContainText("7,00");
  await page
    .getByRole("button", { name: "Удалить: Авокадо", exact: true })
    .click();
  await expect(page.locator(".product-row")).toHaveCount(1);
  await expect(page.locator(".basket-summary")).toContainText("3,00");
  await expect(page.locator(".spinner")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: `Увеличить количество: ${longName}` }),
  ).toBeVisible();
  release();
  await expect(page.locator(".basket-benefit")).toContainText(
    "Евроопт · 1,00 BYN",
  );
});

test("opening a basket product and closing it keeps the store and does not reload cart or comparison", async ({
  page,
}) => {
  await mockCart(page);
  let cartReads = 0;
  let compares = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/cart") && request.method() === "GET")
      cartReads++;
    if (request.url().endsWith("/api/yandex/compare")) compares++;
  });
  await page.route("**/api/product", (route) => {
    const body = route.request().postDataJSON();
    return route.fulfill({
      json: {
        storeId: body.storeId,
        id: body.id,
        status: "ok",
        product: source(body.storeId, body.id, longName, 5),
      },
    });
  });
  await page.route("**/api/yandex/search", (route) =>
    route.fulfill({ json: { status: "ok", products: [] } }),
  );
  await page.goto("/basket");
  await page.getByRole("button", { name: "Только необходимые" }).click();
  await page.getByRole("tab", { name: /Green/ }).click();
  const product = page.locator(".row-preview-link").first();
  await expect(product).toBeVisible();
  const reads = cartReads;
  const comparisons = compares;
  await product.click();
  const dialog = page.getByRole("dialog", { name: "Карточка товара" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/\/basket$/);
  await expect(page.getByRole("tab", { name: /Green/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(cartReads).toBe(reads);
  expect(compares).toBe(comparisons);
});
