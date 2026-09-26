<script setup lang="ts">
const phoneNumber = ref("");
const password = ref("");
const register = ref(false);
const pending = ref(false);
const error = ref("");
const message = ref("");
const { data: user, refresh, status } = await useFetch<{ id: string; phoneNumber: string }>("/api/auth/me", { retry: 0 });
async function submit() {
  pending.value = true; error.value = ""; message.value = "";
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
      await refresh();
    }
  } catch (e: any) {
    const code = e.statusCode || e.status;
    error.value = code === 401 ? "Неверный номер телефона или пароль." : code === 409 ? "Этот номер уже зарегистрирован. Войдите в аккаунт." : code === 429 ? "Слишком много попыток. Попробуйте через минуту." : code === 400 ? "Проверьте номер +375 и пароль от 8 до 128 символов." : "Сервер временно недоступен. Попробуйте ещё раз.";
  } finally { pending.value = false; }
}
async function logout() {
  pending.value = true; error.value = "";
  try {
    await $fetch("/api/auth/logout", { method: "POST", retry: 0 });
    user.value = null;
  } catch { error.value = "Не удалось выйти. Попробуйте ещё раз."; }
  finally { pending.value = false; }
}
</script>
<template>
  <section class="account-panel">
    <template v-if="user">
      <p class="account-eyebrow">ВАШ АККАУНТ</p>
      <h1>Вы вошли в Nabo</h1>
      <p>{{ user.phoneNumber }}</p>
      <p>Корзины и избранное сохраняются в этом браузере.</p>
      <button class="account-submit" :disabled="pending" @click="logout">Выйти</button>
    </template>
    <template v-else>
      <p class="account-eyebrow">ДОБРО ПОЖАЛОВАТЬ В NABO</p>
      <h1>{{ register ? 'Создать аккаунт' : 'Войти в аккаунт' }}</h1>
      <p>Ваши идеи для ужина начинаются здесь.</p>
      <form @submit.prevent="submit" class="account-form">
        <label for="phone">Номер телефона</label>
        <input id="phone" v-model="phoneNumber" type="tel" autocomplete="tel" placeholder="+375 29 123-45-67" maxlength="32" required />
        <label for="password">Пароль</label>
        <input id="password" v-model="password" type="password" :autocomplete="register ? 'new-password' : 'current-password'" minlength="8" maxlength="128" required />
        <small v-if="register">От 8 до 128 символов. Подтверждение по SMS пока не используется.</small>
        <button class="account-submit" :disabled="pending || status === 'pending'">{{ pending ? 'Подождите…' : register ? 'Зарегистрироваться' : 'Войти' }}</button>
      </form>
      <button class="account-switch" :disabled="pending" @click="register = !register; error = ''; message = ''">{{ register ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться' }}</button>
    </template>
    <p v-if="error" role="alert" class="account-error">{{ error }}</p>
    <p v-if="message" role="status">{{ message }}</p>
  </section>
</template>
<style scoped>
.account-panel { max-width: 460px; margin: 64px auto; padding: 28px; background: white; border: 1px solid #e4e7ed; border-radius: 24px; }
.account-eyebrow { font-size: 11px; font-weight: 700; color: #3b5bff; letter-spacing: .1em; }
h1 { font-size: 28px; margin: 16px 0; } p { line-height: 1.6; }
.account-form { display: grid; gap: 12px; margin-top: 24px; }
label { font-weight: 600; } input { padding: 14px; border: 1px solid #b7bdcb; border-radius: 12px; width: 100%; font: inherit; }
.account-submit { width: 100%; padding: 14px; border: 0; border-radius: 12px; background: #3b5bff; color: white; font: inherit; font-weight: 600; margin-top: 12px; cursor: pointer; }
button:disabled { opacity: .55; cursor: wait; }.account-switch { display: block; margin: 20px auto 0; border: 0; background: none; color: #3b5bff; cursor: pointer; font: inherit; }
.account-error { color: #b42318; } @media(max-width: 500px) { .account-panel { margin: 24px 12px; padding: 22px; } }
</style>
