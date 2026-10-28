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
async function mockCart(
  page: import("@playwright/test").Page,
  stale = false,
  images = false,
  perStore = false,
  rowCount = 2,
) {
  await page.route("**/api/yandex/compare-capabilities", (route) =>
    route.fulfill({ json: { perStore } }),
  );
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
  cart.push(
    ...Array.from({ length: Math.max(0, rowCount - 2) }, (_, index) => ({
      storeId: "green",
      id: `extra-${index}`,
      name: `${longName} · вариант ${index + 1}`,
      count: 1,
      unit: "1 л",
    })),
  );
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
    const body = route.request().postDataJSON();
    const input = body.items;
    return route.fulfill({
      json: {
        offers: retailStores
          .filter((store) => !body.storeId || store.id === body.storeId)
          .map((store) => ({
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
                  : {
                      ...source(
                        store.id,
                        `${store.id}-${item.id}`,
                        item.query,
                        store.id === "evroopt"
                          ? 1
                          : store.id === "sosedi"
                            ? 3 + index
                            : 5 + index,
                      ),
                      image: images
                        ? `https://avatars.mds.yandex.net/get-eda/1/${store.id}-${index}/orig`
                        : null,
                    },
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
    "https://green-dostavka.by/?utm_source=nabo&utm_medium=referral&utm_campaign=outbound",
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
  const before = await page
    .locator(".product-row")
    .first()
    .evaluate((node) => node.getBoundingClientRect().top + window.scrollY);
  await page
    .getByRole("button", { name: "Удалить: Авокадо", exact: true })
    .click();
  await expect(page.locator(".product-row")).toHaveCount(1);
  await expect(page.locator(".nabo-toast")).toContainText(
    "Сохраняем изменения",
  );
  expect(
    await page
      .locator(".product-row")
      .first()
      .evaluate((node) => node.getBoundingClientRect().top + window.scrollY),
  ).toBe(before);
  await expect(page.locator(".basket-summary")).toContainText("3,00");
  await expect(page.locator(".spinner")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: `Увеличить количество: ${longName}` }),
  ).toBeVisible();
  release();
  await expect(page.locator(".nabo-toast")).toHaveCount(0);
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

test("store switching replaces image nodes and does not retain another retailer photo", async ({
  page,
}) => {
  await page.route("https://avatars.mds.yandex.net/**", (r) =>
    r.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="lime"/></svg>',
    }),
  );
  await mockCart(page, false, true);
  await page.goto("/basket");
  const first = page.locator(".store-product-line .product-image").first();
  await expect(first).toHaveAttribute("src", /sosedi-0/);
  await expect(first).toHaveAttribute("loading", "eager");
  const old = await first.elementHandle();
  await page.getByRole("tab", { name: /Green/ }).click();
  await expect(first).toHaveAttribute("src", /green-0/);
  expect(await old!.evaluate((node) => node.isConnected)).toBe(false);
  await expect
    .poll(() =>
      first.evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.getByRole("tab", { name: /Соседи/ }).click();
  await expect(first).toHaveAttribute("src", /sosedi-0/);
  await expect
    .poll(() =>
      first.evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
});

test("store comparisons render the first completed result while other stores are still loading", async ({
  page,
}) => {
  await mockCart(page, false, false, true);
  const releases = new Map<string, () => void>();
  const requests: any[] = [];
  await page.route("**/api/yandex/compare", async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    await new Promise<void>((resolve) => releases.set(body.storeId, resolve));
    if (body.storeId === "evroopt")
      return route.fulfill({ status: 502, json: { message: "Unavailable" } });
    await route.fallback();
  });
  await page.goto("/basket");
  await expect.poll(() => requests.length).toBe(6);
  expect(new Set(requests.map((request) => request.storeId)).size).toBe(6);
  expect(requests.every((request) => request.items.length === 2)).toBe(true);
  releases.get("green")!();
  await expect(page.getByRole("tab", { name: /Green/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator(".product-row")).toHaveCount(2);
  await expect(page.locator(".basket-summary")).toContainText("11,00");
  await expect(page.locator(".basket-benefit")).toContainText(
    "проверяем остальные",
  );
  await expect(page.getByRole("tab", { name: /Соседи/ })).toContainText(
    "Проверяем",
  );
  await page.getByRole("tab", { name: /Соседи/ }).click();
  await expect(page.locator(".store-basket-status")).toContainText(
    "Сравниваем",
  );
  releases.get("sosedi")!();
  await expect(page.locator(".basket-summary")).toContainText("7,00");
  await expect(page.getByRole("tab", { name: /Соседи/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  for (const id of ["evroopt", "gippo", "belmarket", "santa"])
    releases.get(id)!();
  await expect(page.getByRole("tab", { name: /Евроопт/ })).toContainText(
    "Нет ответа",
  );
  await expect(page.locator(".basket-benefit")).not.toContainText(
    "проверяем остальные",
  );
  await expect(page.locator(".basket-summary")).toContainText("7,00");
  await page.waitForTimeout(1000);
  expect(requests).toHaveLength(6);
});

test("quantity edits during partial comparison remain optimistic and ignore old responses", async ({
  page,
}) => {
  await mockCart(page, false, false, true);
  let releaseComparisons!: () => void;
  let releaseSave!: () => void;
  const comparisonsGate = new Promise<void>((resolve) => {
    releaseComparisons = resolve;
  });
  const saveGate = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  let writes = 0;
  await page.route("**/api/cart**", async (route) => {
    if (route.request().method() === "POST") {
      writes++;
      await saveGate;
    }
    await route.fallback();
  });
  await page.route("**/api/yandex/compare", async (route) => {
    if (route.request().postDataJSON().storeId !== "green")
      await comparisonsGate;
    await route.fallback();
  });
  await page.goto("/basket");
  await expect(page.locator(".basket-summary")).toContainText("11,00");
  await page
    .getByRole("button", { name: `Увеличить количество: ${longName}` })
    .click();
  await expect(page.locator(".basket-summary")).toContainText("16,00");
  await expect(page.locator(".product-row")).toHaveCount(2);
  await expect(page.locator(".spinner")).toHaveCount(0);
  await expect.poll(() => writes).toBe(1);
  releaseComparisons();
  releaseSave();
  await expect(page.locator(".basket-benefit")).toContainText(
    "Соседи · 10,00 BYN",
  );
  await expect(page.locator(".basket-summary")).toContainText("16,00");
});

test("mobile purchase bar and long basket rows never overlap at narrow widths", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile", "Mobile checkout layout");
  await mockCart(page, false, false, false, 14);
  await page.goto("/basket");
  await expect(page.locator(".basket-summary")).toContainText("133,00");
  await expect(page.locator(".mobile-nav")).toBeHidden();
  await expect(page.locator(".cookie-consent")).toHaveCSS("position", "static");
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 780 });
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const summary = await page.locator(".basket-summary").boundingBox();
    expect(summary!.y + summary!.height).toBeLessThanOrEqual(780);
    expect(summary!.height).toBeLessThanOrEqual(112);
    const cta = page.locator(".basket-actions a");
    await expect(cta).toBeVisible();
    expect(
      await cta.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return el.contains(
          document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
        );
      }),
    ).toBe(true);
    for (const row of await page.locator(".product-row").all()) {
      const quantity = await row.locator(".quantity").boundingBox();
      const price = await row.locator(".row-price").boundingBox();
      const replace = await row.locator(".row-replace").boundingBox();
      expect(replace!.x + replace!.width).toBeLessThanOrEqual(quantity!.x);
      expect(quantity!.x + quantity!.width).toBeLessThanOrEqual(price!.x);
      const name = await row.locator(".product-name h3").boundingBox();
      const remove = await row.locator(".delete").boundingBox();
      expect(name!.x + name!.width).toBeLessThanOrEqual(remove!.x);
      expect(name!.height).toBeLessThanOrEqual(56);
    }
    await page.screenshot({
      path: `/tmp/nabo-basket-checkout-${width}.png`,
      fullPage: false,
    });
    await page
      .locator(".product-row")
      .last()
      .evaluate((el) => el.scrollIntoView({ block: "center" }));
    const lastRow = await page.locator(".product-row").last().boundingBox();
    const bottomBar = await page.locator(".basket-summary").boundingBox();
    const tabs = await page.locator(".basket-store-tabs").boundingBox();
    const header = await page.locator(".header").boundingBox();
    expect(lastRow!.y + lastRow!.height).toBeLessThanOrEqual(bottomBar!.y);
    expect(tabs!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
    await expect(cta).toBeInViewport();
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("tab", { name: /Евроопт/ }).click();
  await expect(page.locator(".summary-partial")).toBeVisible();
  await expect(page.locator(".store-missing-row").first()).toBeVisible();
  await page.getByRole("tab", { name: /Green/ }).click();
  await page
    .getByRole("button", {
      name: `Увеличить количество: ${longName}`,
      exact: true,
    })
    .click();
  await expect(page.locator(".row-unit-price").first()).toContainText("5,00");
  await expect(page.locator(".basket-summary")).toContainText("166,00");
});
