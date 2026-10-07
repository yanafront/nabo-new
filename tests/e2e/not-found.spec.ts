import { test, expect } from "@playwright/test";
test("неизвестная ссылка показывает Nabo 404 и позволяет продолжить поиск", async ({
  page,
}) => {
  const response = await page.goto("/missing-nabo-test-page");
  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle("Страница не найдена · Nabo");
  await expect(
    page.getByRole("heading", { name: "Страница не найдена", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Найти товары", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Выбрать рецепт", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "Найти товары", exact: true }).click();
  await expect(page).toHaveURL(/\/products$/);
  await expect(
    page.getByRole("heading", { name: "Страница не найдена", exact: true }),
  ).toHaveCount(0);
});
