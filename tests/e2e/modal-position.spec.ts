import { test, expect, type Page } from "@playwright/test";
async function centered(page: Page) {
  await expect
    .poll(() =>
      page.getByRole("dialog").evaluate((dialog) => {
        const b = dialog.getBoundingClientRect(),
          v = window.visualViewport;
        return Math.max(
          Math.abs(b.left + b.width / 2 - (v?.width || innerWidth) / 2),
          Math.abs(
            b.top +
              b.height / 2 -
              ((v?.offsetTop || 0) + (v?.height || innerHeight) / 2),
          ),
        );
      }),
    )
    .toBeLessThan(2);
  const bounds = await page.getByRole("dialog").boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(10);
  expect(bounds!.y).toBeGreaterThanOrEqual(10);
}
test("mobile dialogs stay centered after scroll and viewport resize", async ({
  page,
}, info) => {
  test.skip(!info.project.use.isMobile);
  await page.goto("/products");
  await page
    .getByRole("button", { name: "Только необходимые", exact: true })
    .click();
  await page.locator(".footer").scrollIntoViewIfNeeded();
  await page
    .getByRole("button", { name: "Как работает Nabo", exact: true })
    .click();
  await centered(page);
  await page.setViewportSize({ width: 320, height: 568 });
  await centered(page);
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await page.evaluate(() => scrollTo(0, 0));
  await page
    .locator("header")
    .getByRole("button", { name: "Минск, центр", exact: true })
    .click();
  await centered(page);
  await page.setViewportSize({ width: 390, height: 600 });
  await centered(page);
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
});
