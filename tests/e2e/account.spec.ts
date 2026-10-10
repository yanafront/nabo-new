import { test, expect } from "@playwright/test";
test("регистрация, вход, выход и мобильная вёрстка", async ({ page }) => {
  let signedIn = false;
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: signedIn ? 200 : 401,
      json: signedIn ? { id: "test", phoneNumber: "+375291234567" } : {},
    }),
  );
  await page.route("**/api/auth/register", (route) =>
    route.fulfill({
      status: 201,
      json: { id: "test", phoneNumber: "+375291234567" },
    }),
  );
  await page.route("**/api/auth/login", (route) => {
    signedIn = true;
    return route.fulfill({ json: { authenticated: true } });
  });
  await page.route("**/api/auth/logout", (route) => {
    signedIn = false;
    return route.fulfill({ json: { authenticated: false } });
  });
  await page.goto("/");
  await page.getByRole("link", { name: "Аккаунт", exact: true }).click();
  await page
    .getByRole("button", { name: "Нет аккаунта? Зарегистрироваться" })
    .click();
  await page.getByLabel("Номер телефона").fill("+375291234567");
  await page.getByLabel("Пароль", { exact: true }).fill("sample-password");
  await page
    .getByRole("button", { name: "Зарегистрироваться", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Аккаунт создан");
  await page.getByLabel("Пароль", { exact: true }).fill("sample-password");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Вы вошли в Nabo" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Войти в аккаунт" }),
  ).toBeVisible();
});
test("ошибка входа отображается в форме", async ({ page }) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await page.goto("/");
  await page.getByRole("link", { name: "Аккаунт", exact: true }).click();
  await page.getByLabel("Номер телефона").fill("+375291234567");
  await page.getByLabel("Пароль", { exact: true }).fill("sample-password");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Неверный номер телефона или пароль.",
  );
});

test("вход сохраняет форму и показывает ожидание до загрузки аккаунта", async ({
  page,
}) => {
  let signedIn = false;
  let finishLogin!: () => void;
  let finishSession!: () => void;
  const loginGate = new Promise<void>((resolve) => {
    finishLogin = resolve;
  });
  const sessionGate = new Promise<void>((resolve) => {
    finishSession = resolve;
  });
  await page.route("**/api/auth/me", async (route) => {
    if (signedIn) await sessionGate;
    await route.fulfill({
      status: signedIn ? 200 : 401,
      json: signedIn ? { id: "test", phoneNumber: "+375291234567" } : {},
    });
  });
  let calls = 0;
  await page.route("**/api/auth/login", async (route) => {
    calls++;
    await loginGate;
    signedIn = true;
    await route.fulfill({ json: { authenticated: true } });
  });
  await page.route("**/api/cart?**", (route) =>
    route.fulfill({ json: { items: [] } }),
  );
  await page.route("**/api/cart", (route) =>
    route.fulfill({ json: { items: [] } }),
  );
  await page.goto("/account");
  await expect(
    page.getByRole("button", { name: "Войти", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Номер телефона").fill("+375291234567");
  await page.getByLabel("Пароль", { exact: true }).fill("sample-password");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Входим в аккаунт…", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("Подключаем аккаунт");
  await expect(page.getByLabel("Пароль", { exact: true })).toHaveValue(
    "sample-password",
  );
  finishLogin();
  await expect(
    page.getByRole("button", { name: "Входим в аккаунт…", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Пароль", { exact: true })).toHaveValue(
    "sample-password",
  );
  finishSession();
  await expect(
    page.getByRole("heading", { name: "Вы вошли в Nabo" }),
  ).toBeVisible();
  expect(calls).toBe(1);
});
