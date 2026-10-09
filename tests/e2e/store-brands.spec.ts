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
