import { test, expect } from "@playwright/test";
import { retailStores } from "../../shared/yandex";
const name =
  "Молоко питьевое стерилизованное натуральное цельное с витаминами для всей семьи, 1 л";
const product = {
  storeId: "evroopt",
  id: "milk",
  placeSlug: "evroopt",
  name,
  price: 3.89,
  oldPrice: 4.19,
  unit: "1 л",
  available: true,
  stock: null,
  image: "https://avatars.mds.yandex.net/get-eda/1/preview-milk/orig",
  fetchedAt: new Date().toISOString(),
  description: "Состав: молоко. Хранить согласно условиям на упаковке.",
};
test("product dialog preserves search, scroll and store, supports alternatives and closing", async ({
  page,
}, info) => {
  if (info.project.name === "mobile")
    await page.setViewportSize({ width: 320, height: 780 });
  await page.route("**/get-eda/1/preview-milk/orig", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="800"><rect width="160" height="800" rx="12" fill="#c7ff3b"/></svg>',
    }),
  );
  let searches = 0;
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await page.route("**/api/search", (route) => {
    searches++;
    return route.fulfill({
      json: {
        stores: retailStores.map((store) => ({
          storeId: store.id,
          status: "ok",
          products:
            store.id === "evroopt"
              ? [
                  product,
                  ...Array.from({ length: 19 }, (_, i) => ({
                    ...product,
                    id: `milk-${i}`,
                    name: `Молоко ${i}`,
                  })),
                ]
              : [],
          total: store.id === "evroopt" ? 20 : 0,
          fetchedAt: product.fetchedAt,
        })),
      },
    });
  });
  await page.route("**/api/product", (route) =>
    route.fulfill({
      json: {
        storeId: "evroopt",
        id: "milk",
        status: "ok",
        product,
        fetchedAt: product.fetchedAt,
      },
    }),
  );
  await page.route("**/api/yandex/search", (route) => {
    const { storeId } = route.request().postDataJSON();
    return route.fulfill({
      json: {
        storeId,
        status: "ok",
        products:
          storeId === "green"
            ? [{ ...product, storeId: "green", id: "same-milk", price: 3.49 }]
            : [],
        fetchedAt: product.fetchedAt,
      },
    });
  });
  await page.goto("/products?q=Молоко&store=evroopt");
  await page.getByRole("button", { name: "Только необходимые" }).click();
  const link = page.locator(".catalog-product-link").first();
  await expect(link).toContainText(name);
  await link.scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => window.scrollY);
  await link.click();
  const dialog = page.getByRole("dialog", { name: "Карточка товара" });
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(
    Math.abs(bounds!.x + bounds!.width / 2 - page.viewportSize()!.width / 2),
  ).toBeLessThan(2);
  await expect(
    dialog.getByRole("heading", { name, exact: true, level: 1 }),
  ).toBeVisible();
  await expect(dialog.locator(".product-preview-buy")).toContainText("3,89");
  await expect(dialog.locator(".product-preview-buy button")).toBeInViewport();
  if (info.project.name === "mobile") {
    const photo = dialog.locator(".product-detail-image > .product-image");
    await expect(photo).toBeVisible();
    await expect(photo).toHaveCSS("object-fit", "contain");
    const hero = await dialog.locator(".product-detail-image").boundingBox();
    expect(hero!.width).toBe(page.viewportSize()!.width);
    expect(hero!.x).toBe(0);
    const bar = await dialog.locator(".product-preview-buy").boundingBox();
    expect(
      Math.abs(bar!.y + bar!.height - page.viewportSize()!.height),
    ).toBeLessThan(2);
    await dialog
      .locator(".product-content")
      .evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await expect(
      dialog.getByRole("button", { name: "Закрыть", exact: true }),
    ).toBeInViewport();
    await expect(
      dialog.locator(".product-preview-buy button"),
    ).toBeInViewport();
    await dialog
      .locator(".product-content")
      .evaluate((el) => el.scrollTo(0, 0));
  }
  await expect(page).toHaveURL(/\/products\?q=/);
  expect(
    await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  await expect(
    dialog.getByRole("heading", { name: "Такой же товар в других магазинах" }),
  ).toBeVisible();
  await page.screenshot({
    path: `/tmp/nabo-product-preview-${info.project.name}.png`,
  });
  const before = searches;
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(scroll);
  expect(searches).toBe(before);
  await expect(page.getByRole("tab").first()).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await link.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(searches).toBe(before);
  await page.goto("/product/evroopt/milk?name=Молоко");
  await expect(
    page.getByRole("heading", { name, exact: true, level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  if (info.project.name === "mobile") {
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 780 });
      await expect(page.locator(".mobile-nav")).toBeHidden();
      const photo = page.locator(".product-detail-image > .product-image");
      await expect(photo).toBeVisible();
      const hero = await page.locator(".product-detail-image").boundingBox();
      expect(hero!.width).toBe(width);
      expect(hero!.x).toBe(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const cta = page.locator(".product-page-buy button");
      await expect(cta).toBeInViewport();
      expect(
        await cta.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return el.contains(
            document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
          );
        }),
      ).toBe(true);
      await page.screenshot({ path: `/tmp/nabo-product-page-${width}.png` });
    }
    await page.locator(".product-page-buy button").click();
    await expect(page.locator(".product-page-buy button")).toContainText(
      "Добавить ещё",
    );
    await expect(
      page.locator(".product-page-buy .preview-price"),
    ).toContainText("1 в корзине");
  }
});
