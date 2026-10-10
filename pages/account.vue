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
const signingIn = ref(false);
const error = ref("");
const message = ref("");
const { data: user, refresh, status } = await useAccount();
watch(
  user,
  (value) => {
    if (value && !signingIn.value) void navigateTo(returnTo.value || "/");
  },
  { immediate: true },
);
async function submit() {
  if (pending.value) return;
  signingIn.value = true;
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
      resetFavorites();
      await cartSync.login();
      await refresh();
      if (!user.value) throw new Error("Session unavailable");
      password.value = "";
      if (user.value) await navigateTo(returnTo.value || "/");
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
    signingIn.value = false;
    pending.value = false;
  }
}
</script>
<template>
  <section class="account-panel">
    <div
      v-if="(status === 'pending' || user) && !signingIn"
      class="account-session-loading"
      role="status"
    >
      <span class="spinner" aria-hidden="true" />
      <p>Проверяем вход в аккаунт…</p>
    </div>
    <template v-else>
      <p class="account-eyebrow">ДОБРО ПОЖАЛОВАТЬ В NABO</p>
      <h1>{{ register ? "Создать аккаунт" : "Войти в аккаунт" }}</h1>
      <p>
        {{
          returnTo
            ? "Войдите, чтобы сохранять товары и корзины в Nabo."
            : "Войдите, чтобы собирать корзину и сравнивать цены."
        }}
      </p>
      <form @submit.prevent="submit" class="account-form" :aria-busy="pending">
        <label for="phone">Номер телефона</label>
        <input
          id="phone"
          :disabled="pending"
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
          :disabled="pending"
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
          :class="{ 'is-loading': pending }"
          :disabled="pending || status === 'pending'"
        >
          <span v-if="pending" class="spinner" aria-hidden="true" />
          {{
            pending
              ? register
                ? "Создаём аккаунт…"
                : "Входим в аккаунт…"
              : register
                ? "Зарегистрироваться"
                : "Войти"
          }}
        </button>
        <p v-if="pending" class="account-progress" role="status">
          {{
            register
              ? "Сохраняем данные аккаунта"
              : "Подключаем аккаунт и вашу корзину"
          }}
        </p>
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

<style scoped>
.account-submit.is-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  opacity: 1;
}
.account-submit .spinner {
  width: 18px;
  height: 18px;
  margin: 0;
  border-width: 2px;
  border-color: rgb(15 15 16 / 15%);
  border-top-color: var(--ink);
}
.account-progress {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
  text-align: center;
}
.account-session-loading {
  display: grid;
  justify-items: center;
  padding: 32px 0;
  color: var(--muted);
}
</style>
