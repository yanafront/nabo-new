import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const seed = JSON.parse(
  readFileSync(new URL("../fixtures/recipes.json", import.meta.url), "utf8"),
);
test("recipe dialogs stay centered in the visible mobile viewport", async ({
  page,
}, info) => {
  test.skip(!info.project.use.isMobile);
  await page.route("**/api/recipes/syrniki", (route) =>
    route.fulfill({
      json: {
        recipe: seed.recipes.find((r: any) => r.slug === "syrniki"),
        ingredients: seed.ingredients,
      },
    }),
  );
  await page.route("**/api/dining/search?*", (route) =>
    route.fulfill({ json: { offers: [] } }),
  );
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
                unit: "200 г",
                price: 2,
                available: true,
                stock: null,
                storeId: body.storeId,
                placeSlug: body.storeId,
                fetchedAt: "",
              },
            ],
          },
        })),
      },
    });
  });
  await page.goto("/recipes/syrniki");
  const retry = page.getByRole("button", { name: "Повторить", exact: true });
  if (await retry.isVisible()) await retry.click();
  const cookies = page.getByRole("button", {
    name: "Только необходимые",
    exact: true,
  });
  if (await cookies.isVisible()) await cookies.click();
  const products = page.getByRole("button", {
    name: "Посмотреть товары",
    exact: true,
  });
  await expect(products).toBeVisible();
  await page.locator("footer").scrollIntoViewIfNeeded();
  // Keep the background scrolled when opening the dialog.
  await products.evaluate((el: HTMLButtonElement) => el.click());
  const dialog = page.getByRole("dialog");
  const centered = async () => {
    await expect
      .poll(() =>
        dialog.evaluate((el) => {
          const rect = el.getBoundingClientRect(),
            v = window.visualViewport;
          return Math.max(
            Math.abs(
              rect.top +
                rect.height / 2 -
                ((v?.offsetTop || 0) + (v?.height || innerHeight) / 2),
            ),
            Math.abs(
              rect.left +
                rect.width / 2 -
                ((v?.offsetLeft || 0) + (v?.width || innerWidth) / 2),
            ),
          );
        }),
      )
      .toBeLessThan(2);
    const rect = await dialog.boundingBox();
    expect(rect!.y).toBeGreaterThanOrEqual(10);
    expect(rect!.y + rect!.height).toBeLessThanOrEqual(
      page.viewportSize()!.height - 10,
    );
  };
  await expect(dialog).toHaveClass(/found-products-modal/);
  await centered();
  await page.setViewportSize({ width: 390, height: 568 });
  await centered();
  await expect(
    dialog.getByRole("button", {
      name: "Добавить товары в корзину",
      exact: true,
    }),
  ).toBeInViewport();
  await page.screenshot({
    path: `/tmp/nabo-recipe-modal-${info.project.name}.png`,
  });
  await dialog.getByRole("button", { name: "Закрыть", exact: true }).click();
  await page
    .getByRole("button", { name: "Собрать корзину", exact: true })
    .evaluate((el: HTMLButtonElement) => el.click());
  await expect(dialog).toHaveClass(/modal-drawer/);
  await centered();
  await page.setViewportSize({ width: 390, height: 844 });
  await centered();
});
