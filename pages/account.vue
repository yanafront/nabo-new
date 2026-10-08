<script setup lang="ts">
import { authReturnPath } from "~/shared/auth-return";
const route = useRoute();
const returnTo = computed(() => authReturnPath(route.query.returnTo));
const cartSync = useCartSync();
const { reset: resetFavorites } = useFavorites();
const phoneNumber = ref("");
const password = ref("");
const register = ref(false);
const pending = ref(false);
const error = ref("");
const message = ref("");
const {
  data: user,
  refresh,
  status,
} = await useFetch<{ id: string; phoneNumber: string }>("/api/auth/me", {
  retry: 0,
  lazy: true,
  timeout: 15000,
});
async function submit() {
  pending.value = true;
  error.value = "";
  message.value = "";
  try {
    const body = { phoneNumber: phoneNumber.value, password: password.value };
    if (register.value) {
      await $fetch("/api/auth/register", { method: "POST", body, retry: 0 });
      register.value = false;
      message.value = "Аккаунт создан. Войдите с вашим номером и паролем.";
      password.value = "";
    } else {
      await $fetch("/api/auth/login", { method: "POST", body, retry: 0 });
      password.value = "";
      resetFavorites();
      await cartSync.login();
      await refresh();
      if (user.value && returnTo.value) await navigateTo(returnTo.value);
    }
  } catch (e: any) {
    const code = e.statusCode || e.status;
    error.value =
      code === 401
        ? "Неверный номер телефона или пароль."
        : code === 409
          ? "Этот номер уже зарегистрирован. Войдите в аккаунт."
          : code === 429
            ? "Слишком много попыток. Попробуйте через минуту."
            : code === 400
              ? "Проверьте номер +375 и пароль от 8 до 128 символов."
              : "Сервер временно недоступен. Попробуйте ещё раз.";
  } finally {
    pending.value = false;
  }
}
async function logout() {
  pending.value = true;
  error.value = "";
  try {
    await $fetch("/api/auth/logout", { method: "POST", retry: 0 });
    cartSync.logout();
    user.value = null;
    resetFavorites();
  } catch {
    error.value = "Не удалось выйти. Попробуйте ещё раз.";
  } finally {
    pending.value = false;
  }
}
</script>
<template>
  <section class="account-panel">
    <template v-if="user">
      <p class="account-eyebrow">ВАШ АККАУНТ</p>
      <h1>Вы вошли в Nabo</h1>
      <p>{{ user.phoneNumber }}</p>
      <p>
        Текущую корзину можно сохранить в аккаунте. Списки для повторных покупок
        остаются в этом браузере.
      </p>
      <NuxtLink v-if="returnTo" :to="returnTo" class="text-button"
        >Продолжить</NuxtLink
      >
      <AccountCart :authenticated="true" />
      <button class="account-submit" :disabled="pending" @click="logout">
        Выйти
      </button>
    </template>
    <template v-else>
      <p class="account-eyebrow">ДОБРО ПОЖАЛОВАТЬ В NABO</p>
      <h1>{{ register ? "Создать аккаунт" : "Войти в аккаунт" }}</h1>
      <p>
        {{
          returnTo
            ? "Войдите, чтобы сохранять товары и корзины в Nabo."
            : "Собирать корзину и сравнивать цены можно без входа."
        }}
      </p>
      <form @submit.prevent="submit" class="account-form">
        <label for="phone">Номер телефона</label>
        <input
          id="phone"
          v-model="phoneNumber"
          type="tel"
          autocomplete="tel"
          placeholder="+375 29 123-45-67"
          maxlength="32"
          required
        />
        <label for="password">Пароль</label>
        <input
          id="password"
          v-model="password"
          type="password"
          :autocomplete="register ? 'new-password' : 'current-password'"
          minlength="8"
          maxlength="128"
          required
        />
        <small v-if="register"
          >От 8 до 128 символов. Подтверждение по SMS пока не
          используется.</small
        >
        <button
          class="account-submit"
          :disabled="pending || status === 'pending'"
        >
          {{
            pending ? "Подождите…" : register ? "Зарегистрироваться" : "Войти"
          }}
        </button>
      </form>
      <button
        class="account-switch"
        :disabled="pending"
        @click="
          register = !register;
          error = '';
          message = '';
        "
      >
        {{
          register
            ? "Уже есть аккаунт? Войти"
            : "Нет аккаунта? Зарегистрироваться"
        }}
      </button>
    </template>
    <p v-if="error" role="alert" class="account-error">{{ error }}</p>
    <p v-if="message" role="status">{{ message }}</p>
  </section>
</template>
