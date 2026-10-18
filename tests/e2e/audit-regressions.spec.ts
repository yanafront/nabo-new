import { test, expect } from "@playwright/test";
import catalog from "../fixtures/recipes.json" with { type: "json" };

test("delivery handles missing photos and recovers from a catalogue outage", async ({
  page,
}) => {
  let unavailable = true;
  await page.route("**/api/recipes?**", (route) =>
    route.fulfill(
      unavailable
        ? { status: 503, json: { message: "Unavailable" } }
        : {
            json: {
              recipes: catalog.recipes
                .slice(0, 2)
                .map((recipe, i) => ({
                  ...recipe,
                  image: i ? "" : "https://example.com/audit-broken.jpg",
                })),
              total: 2,
            },
          },
    ),
  );
  await page.route("https://example.com/audit-broken.jpg", (route) =>
    route.fulfill({ status: 404, body: "" }),
  );
  await page.goto("/products");
  const consent = page.getByRole("button", {
    name: "Только необходимые",
    exact: true,
  });
  if (await consent.isVisible()) await consent.click();
  await page
    .getByRole("link", { name: "Готовые блюда с доставкой", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Не удалось загрузить блюда. Попробуйте ещё раз."),
  ).toBeVisible();
  await expect(page.locator(".delivery-pagination")).toHaveCount(0);
  unavailable = false;
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(page.locator(".delivery-photo")).toHaveCount(2);
  await expect(page.locator(".delivery-placeholder")).toHaveCount(2);
  await expect(page.locator(".delivery-photo img")).toHaveCount(0);
  const heights = await page
    .locator(".delivery-photo")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getBoundingClientRect().height),
    );
  expect(heights).toEqual([180, 180]);
});
