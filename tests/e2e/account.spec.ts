import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/recipes?**", (route) =>
    route.fulfill({ json: { recipes: [] } }),
  );
  await page.route("**/api/cart?**", (route) =>
    route.fulfill({ json: { items: [] } }),
  );
  await page.route("**/api/cart", (route) =>
    route.fulfill({ json: { items: [] } }),
  );
});

test("гостевой вход сменяется меню аккаунта, выход возвращает кнопку", async ({
  page,
}, info) => {
  let signedIn = false;
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: signedIn ? 200 : 401,
      json: signedIn ? { id: "test", phoneNumber: "+375291234567" } : {},
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
  await page.goto("/account");
  await page.getByLabel("Номер телефона").fill("+375291234567");
  await page.getByLabel("Пароль", { exact: true }).fill("sample-password");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  const menu = page.getByRole("button", { name: "Меню аккаунта" });
  await menu.click();
  await expect(page.locator("#account-dropdown")).toContainText(
    "+375291234567",
  );
  await page.screenshot({
    path: `/tmp/nabo-account-menu-${info.project.name}.png`,
  });
  await page.keyboard.press("Escape");
  await expect(page.locator("#account-dropdown")).toHaveCount(0);
  await menu.click();
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Аккаунт", exact: true }),
  ).toHaveText("Войти");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("ошибка входа сохраняет форму", async ({ page }) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await page.goto("/account");
  await page.getByLabel("Номер телефона").fill("+375291234567");
  await page.getByLabel("Пароль", { exact: true }).fill("sample-password");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Неверный номер телефона или пароль.",
  );
  await expect(page.getByLabel("Пароль", { exact: true })).toHaveValue(
    "sample-password",
  );
});

test("вход сохраняет форму до ответа и затем открывает главную", async ({
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
  await expect(page.getByLabel("Пароль", { exact: true })).toHaveValue(
    "sample-password",
  );
  finishLogin();
  await expect(
    page.getByRole("button", { name: "Входим в аккаунт…", exact: true }),
  ).toBeVisible();
  finishSession();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("button", { name: "Меню аккаунта" }),
  ).toBeVisible();
  expect(calls).toBe(1);
});

test("регистрация работает, документы доступны, аналитика отклоняется отдельно", async ({
  page,
}) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 401, json: {} }),
  );
  await page.goto("/account");
  let registration: unknown;
  await page.route("**/api/auth/register", async (route) => {
    registration = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      json: { id: "new", phoneNumber: "+375291234567" },
    });
  });
  await page
    .getByRole("button", { name: "Нет аккаунта? Зарегистрироваться" })
    .click();
  await page.getByLabel("Номер телефона").fill("+375291234567");
  await page.getByLabel("Пароль", { exact: true }).fill("sample-password");
  await page
    .getByRole("button", { name: "Зарегистрироваться", exact: true })
    .click();
  await expect(
    page.getByText("Аккаунт создан. Войдите с вашим номером и паролем."),
  ).toBeVisible();
  expect(registration).toEqual({
    phoneNumber: "+375291234567",
    password: "sample-password",
  });
  await expect(
    page.getByRole("button", { name: "Войти", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Только необходимые", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Настройки cookies" }),
  ).toHaveCount(0);
  for (const key of ["terms", "privacy", "cookies"]) {
    await page.goto(`/legal/${key}`);
    await expect(page.locator(".legal-document h1")).toBeVisible();
    await expect(page.locator(".legal-draft")).toBeVisible();
    expect(await page.locator('script[src*="mc.yandex"]').count()).toBe(0);
  }
  await page
    .getByRole("button", { name: "Настройки cookies", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("button", { name: "Разрешить аналитику" }),
  ).toBeVisible();
});
