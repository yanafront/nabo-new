import { test, expect } from "@playwright/test";
test("category navigation requests once and keeps cards visible while loading", async ({
  page,
}) => {
  let pastaRequests = 0;
  let release: (() => void) | undefined;
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: null }));
  await page.route("**/api/recipes?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("view") === "categories")
      return route.fulfill({ json: { sections: [] } });
    const category = url.searchParams.get("category") || "salads";
    if (category === "pasta") {
      pastaRequests++;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    }
    return route.fulfill({
      json: {
        total: 1,
        recipes: [
          {
            id: category,
            slug: category,
            title: category === "pasta" ? "Паста с томатами" : "Овощной салат",
            categoryId: category,
            tags: [],
            servings: 2,
            ingredients: [],
            isActive: true,
          },
        ],
      },
    });
  });
  await page.goto("/products");
  await page.locator('a[href="/recipes"]:visible').first().click();
  await page.getByRole("link", { name: "Салаты", exact: true }).click();
  await expect(page.locator(".dish-card")).toContainText("Овощной салат");
  await page.getByRole("link", { name: "Паста", exact: true }).click();
  await expect.poll(() => pastaRequests).toBe(1);
  await expect(page).toHaveURL(/\/recipes\/category\/pasta$/);
  await expect(page.locator(".dish-card")).toContainText("Овощной салат");
  await expect(page.locator(".dish-skeleton")).toHaveCount(0);
  release?.();
  await expect(page.locator(".dish-card")).toContainText("Паста с томатами");
  await page.waitForTimeout(250);
  expect(pastaRequests).toBe(1);
  await page.goBack();
  await expect(page).toHaveURL(/\/recipes\/category\/salads$/);
  await expect(page.locator(".dish-card")).toContainText("Овощной салат");
});
