import { test, expect } from "@playwright/test";
import catalog from "../fixtures/recipes.json" with { type: "json" };
const sizes = [
  [100, 1200],
  [1200, 100],
];
const image = (width: number, height: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#c7ff3b"/></svg>`;
test("catalog photos retain equal frame heights for portrait and landscape uploads", async ({
  page,
}) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await page.route("**/photo-*.svg", (route) => {
    const index = route.request().url().includes("photo-0") ? 0 : 1;
    return route.fulfill({
      contentType: "image/svg+xml",
      body: image(...(sizes[index] as [number, number])),
    });
  });
  await page.route("**/api/recipes?**", (route) =>
    route.fulfill({
      json: {
        recipes: catalog.recipes.slice(0, 2).map((recipe, index) => ({
          ...recipe,
          image: `/photo-${index}.svg`,
        })),
        total: 2,
      },
    }),
  );
  await page.goto("/products");
  await page
    .getByRole("link", { name: "Рецепты", exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "Поиск рецептов", exact: true })
    .fill("сырники");
  const frames = page.locator(".dish-photo");
  await expect(frames).toHaveCount(2);
  await expect
    .poll(() =>
      frames
        .locator("img")
        .evaluateAll((images) =>
          images.every(
            (node) =>
              (node as HTMLImageElement).complete &&
              (node as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  const dimensions = await frames.evaluateAll((nodes) =>
    nodes.map((node) => ({
      frame: node.getBoundingClientRect().height,
      img: node.querySelector("img")!.getBoundingClientRect().height,
      overflow: node.scrollHeight > node.clientHeight,
    })),
  );
  expect(dimensions[0].frame).toBe(dimensions[1].frame);
  expect(
    dimensions.every((row) => row.frame === row.img && !row.overflow),
  ).toBe(true);
  await page.route("https://sosedi-dostavka.by/images/*", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: route.request().url().includes("tall")
        ? image(100, 1200)
        : image(1200, 100),
    }),
  );
  await page.route("**/api/search", (route) =>
    route.fulfill({
      json: {
        stores: [
          {
            storeId: "sosedi",
            status: "ok",
            total: 2,
            products: ["tall", "wide"].map((id) => ({
              id,
              storeId: "sosedi",
              name: `Молоко ${id}`,
              unit: "1 л",
              price: 3,
              available: true,
              stock: null,
              image: `https://sosedi-dostavka.by/images/${id}.png`,
              oldPrice: null,
              placeSlug: "sosedi",
              fetchedAt: new Date().toISOString(),
            })),
          },
        ],
      },
    }),
  );
  await page.goto("/products?q=молоко&store=sosedi");
  const photos = page.locator(".catalog-product-link > img");
  await expect(photos).toHaveCount(2);
  await expect
    .poll(() =>
      photos.evaluateAll((nodes) =>
        nodes.every((node) => (node as HTMLImageElement).naturalWidth > 0),
      ),
    )
    .toBe(true);
  const heights = await photos.evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect().height),
  );
  expect(heights[0]).toBe(heights[1]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("request errors show a dismissible toast without moving the form", async ({
  page,
}) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({ status: 401, json: { statusMessage: "Неверный пароль" } }),
  );
  await page.goto("/account");
  await page.getByRole("button", { name: "Только необходимые" }).click();
  await page.getByLabel("Номер телефона").fill("+375291234567");
  await page.getByLabel("Пароль", { exact: true }).fill("wrong-password");
  const form = page.locator(".account-form");
  const before = await form.boundingBox();
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  const toast = page.locator(".nabo-toast--error");
  await expect(toast).toBeVisible();
  expect((await form.boundingBox())!.height).toBe(before!.height);
  expect(await toast.evaluate((node) => getComputedStyle(node).position)).toBe(
    "static",
  );
  await toast.getByRole("button", { name: "Закрыть уведомление" }).click();
  await expect(toast).toHaveCount(0);
});

test("toast from a modal stays above the backdrop and can be dismissed", async ({
  page,
}, info) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (
          _success: unknown,
          failure: (error: { code: number; message: string }) => void,
        ) => failure({ code: 1, message: "Permission denied" }),
      },
    });
  });
  await page.goto("/products");
  await page.getByRole("button", { name: "Только необходимые" }).click();
  await page.locator(".header .location").click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Моё местоположение", exact: true })
    .click();
  const toast = dialog.locator(".nabo-toast--error");
  await expect(toast).toBeVisible();
  await expect(toast).toBeInViewport();
  await expect.poll(() => toast.evaluate(node => getComputedStyle(node).opacity)).toBe("1");
  const popup = await toast.boundingBox();
  const bounds = await dialog.boundingBox();
  expect(popup!.y).toBeGreaterThanOrEqual(bounds!.y);
  await page.screenshot({ path: `/tmp/nabo-toast-${info.project.name}.png` });
  await toast.getByRole("button", { name: "Закрыть уведомление" }).click();
  await expect(toast).toHaveCount(0);
  await expect(dialog).toBeVisible();
});
