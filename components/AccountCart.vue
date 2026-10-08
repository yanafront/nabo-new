<script setup lang="ts">
defineProps<{ authenticated?: boolean }>();
const { state, error, refresh } = useCartSync();
</script>
<template>
  <section class="account-cart panel">
    <div>
      <h2>Корзина в аккаунте</h2>
      <p class="muted" role="status">
        {{
          state === "guest"
            ? "Войдите, чтобы корзина сохранялась на всех устройствах."
            : state === "loading"
              ? "Загружаем корзину…"
              : state === "saving"
                ? "Сохраняем изменения…"
                : state === "saved"
                  ? "Все изменения сохранены в аккаунте."
                  : "Не удалось обновить корзину в аккаунте."
        }}
      </p>
    </div>
    <NuxtLink
      v-if="state === 'guest'"
      to="/account?returnTo=/basket"
      class="text-button"
      >Войти в аккаунт</NuxtLink
    >
    <button
      v-else
      class="text-button"
      :disabled="state === 'loading' || state === 'saving'"
      @click="refresh"
    >
      {{ state === "error" ? "Повторить" : "Обновить из аккаунта" }}
    </button>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
  </section>
</template>
