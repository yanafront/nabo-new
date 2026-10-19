import { test, expect } from "@playwright/test";
import catalog from "../fixtures/recipes.json" with { type: "json" };
test("home stays usable during recipe API outage and reserves hero geometry", async ({
  page,
}, info) => {
  test.skip(!info.project.use.isMobile);
  let searches = 0,
    release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/images/grocery-hero*", async (route) => {
    await gate;
    await route.continue();
  });
  await page.route("**/api/recipes?**", (route) => {
    searches++;
    return route.fulfill({
      json: {
        recipes: catalog.recipes
          .slice(0, 3)
          .map((recipe) => ({ ...recipe, image: "" })),
      },
    });
  });
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  const html = await response!.text();
  expect(html).toContain("Настройки cookies");
  expect(html).not.toContain("user-scalable=no");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const frame = page.locator(".hero-art");
  const before = await frame.boundingBox();
  expect(before!.height).toBeGreaterThan(150);
  expect(searches).toBe(0);
  release();
  await expect
    .poll(() =>
      page
        .locator(".hero-art img")
        .evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0),
    )
    .toBe(true);
  expect(
    Math.abs((await frame.boundingBox())!.height - before!.height),
  ).toBeLessThan(1);
  await page
    .getByRole("button", { name: "Только необходимые", exact: true })
    .click();
  await page.locator(".inspiration").scrollIntoViewIfNeeded();
  await expect(
    page.locator(".inspiration").getByRole("link", { name: /Все рецепты/ }),
  ).toBeVisible();
  expect(searches).toBe(0);
  await page.evaluate(() => scrollTo(0, 0));
  await page.locator(".inspiration").scrollIntoViewIfNeeded();
  expect(searches).toBe(0);
  expect(errors).toEqual([]);
});
