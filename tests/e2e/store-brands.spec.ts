import { test, expect } from "@playwright/test";
import { retailStores } from "../../shared/yandex";
const names = ["Евроопт", "Green", "Гиппо", "Соседи", "Белмаркет", "Санта"];

test("official local logos keep the requested order and fit store/catalog screens", async ({
  page,
}, info) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 401, json: { message: "Guest" } }),
  );
  await page.route("**/api/search", (route) =>
    route.fulfill({
      json: {
        stores: retailStores.map((store) => ({
          storeId: store.id,
          status: "ok",
          products: [],
          total: 0,
        })),
        fetchedAt: new Date().toISOString(),
      },
    }),
  );
  await page.goto("/stores");
  const images = page.locator(".store-catalog-grid .store-brand img");
  await expect(images).toHaveCount(6);
  await expect(images.last()).toHaveAttribute("src", "/brand/stores/santa.png");
  expect(
    await images.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("alt")),
    ),
  ).toEqual(names);
  await expect
    .poll(() =>
      images.evaluateAll((nodes) =>
        nodes.every(
          (node) =>
            (node as HTMLImageElement).complete &&
            (node as HTMLImageElement).naturalWidth > 0,
        ),
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: `/tmp/nabo-store-logos-${info.project.name}.png`,
    fullPage: true,
  });
  await page.goto("/products?q=Молоко");
  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(6);
  expect(
    await page
      .locator(".product-store-tabs img")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("alt"))),
  ).toEqual(names);
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  await expect(tabs.first()).toHaveCSS("background-color", "rgb(255, 255, 255)");
  if (info.project.name === "desktop") {
    await tabs.nth(1).hover();
    await expect(tabs.nth(1)).toHaveCSS("background-color", "rgb(255, 255, 255)");
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/tmp/nabo-product-logos-${info.project.name}.png`,
    fullPage: true,
  });
});

test("home brands share aligned cells without overflowing on mobile", async ({ page }, info) => {
  await page.route("**/api/recipes?**", route => route.fulfill({ json: { recipes: [] } }));
  await page.goto("/");
  const cells = page.locator(".one-basket-stores li");
  await expect(cells).toHaveCount(6);
  const boxes = await cells.evaluateAll(nodes => nodes.map(node => {
    const box = node.getBoundingClientRect();
    return { width: box.width, height: box.height };
  }));
  expect(new Set(boxes.map(box => Math.round(box.width))).size).toBe(1);
  expect(boxes.every(box => box.height === 48)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator(".home-one-basket").screenshot({ path: `/tmp/nabo-home-brands-${info.project.name}.png` });
});
