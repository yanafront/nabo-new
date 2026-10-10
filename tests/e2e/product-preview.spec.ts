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
  image: null,
  fetchedAt: new Date().toISOString(),
  description: "Состав: молоко. Хранить согласно условиям на упаковке.",
};
test("product dialog preserves search, scroll and store, supports alternatives and closing", async ({
  page,
}, info) => {
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
});
