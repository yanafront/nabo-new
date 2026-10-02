<script setup lang="ts">
import type { AccountCartItem } from "~/shared/yandex";
import { accountCartItems, restoredCartItems } from "~/shared/account-cart";
const props = defineProps<{ authenticated?: boolean }>();
const { items, title, unresolved, pendingIngredients, notice } = useBasket();
const { location } = useRetail();
const signedIn = ref(props.authenticated || false);
const checking = ref(props.authenticated === undefined);
const pending = ref(false);
const error = ref("");
const loaded = ref<AccountCartItem[] | null>(null);
const canLoad = computed(
  () =>
    loaded.value !== null &&
    loaded.value.length <= 20 &&
    loaded.value.every(
      (item) =>
        Number.isInteger(item.count) && item.count > 0 && item.count <= 99,
    ),
);
let controller: AbortController | undefined;
let loadedPoint: { lat: number; lon: number } | undefined;
onMounted(async () => {
  if (props.authenticated !== undefined) return;
  try {
    await $fetch("/api/auth/me", { retry: 0, timeout: 15000 });
    signedIn.value = true;
  } catch {
    signedIn.value = false;
  } finally {
    checking.value = false;
  }
});
function failure(e: any) {
  if (e.statusCode === 401) {
    signedIn.value = false;
    error.value = "Войдите в аккаунт ещё раз.";
  } else
    error.value =
      e.statusCode === 429
        ? "Слишком много запросов. Повторите через минуту."
        : "Не удалось связаться с аккаунтом. Повторите попытку.";
}
async function saveAccount() {
  pending.value = true;
  error.value = "";
  controller = new AbortController();
  const payload = accountCartItems(items.value);
  try {
    await $fetch("/api/cart", {
      method: "POST",
      body: { items: payload },
      retry: 0,
      timeout: 70000,
      signal: controller.signal,
    });
    notice.value = "Корзина сохранена в аккаунте";
  } catch (e) {
    if (!controller.signal.aborted) failure(e);
  } finally {
    pending.value = false;
  }
}
async function loadAccount() {
  pending.value = true;
  error.value = "";
  controller = new AbortController();
  const point = { ...location.value };
  try {
    const result = await $fetch<{ items: AccountCartItem[] }>("/api/cart", {
      query: { lat: point.lat, lon: point.lon },
      retry: 0,
      timeout: 120000,
      signal: controller.signal,
    });
    if (location.value.lat !== point.lat || location.value.lon !== point.lon) {
      error.value = "Точка доставки изменилась. Загрузите корзину ещё раз.";
      return;
    }
    if (!result.items.length) {
      error.value = "В аккаунте пока нет сохранённой корзины.";
      return;
    }
    loadedPoint = point;
    loaded.value = result.items;
    if (
      !items.value.length &&
      !pendingIngredients.value.length &&
      !unresolved.value.length &&
      canLoad.value
    )
      apply();
  } catch (e) {
    if (!controller.signal.aborted) failure(e);
  } finally {
    pending.value = false;
  }
}
function apply() {
  if (!canLoad.value || !loaded.value) return;
  if (
    loadedPoint?.lat !== location.value.lat ||
    loadedPoint?.lon !== location.value.lon
  ) {
    loaded.value = null;
    error.value = "Точка доставки изменилась. Загрузите корзину ещё раз.";
    return;
  }
  items.value = restoredCartItems(loaded.value);
  title.value = "Моя корзина";
  unresolved.value = [];
  pendingIngredients.value = [];
  loaded.value = null;
  notice.value = "Корзина из аккаунта загружена";
  navigateTo("/basket");
}
onBeforeUnmount(() => controller?.abort());
</script>
<template>
  <section class="account-cart panel">
    <div>
      <h2>Корзина в аккаунте</h2>
      <p class="muted">
        {{
          signedIn
            ? "Сохраните текущие товары, чтобы открыть их на другом устройстве. Сохранение заменяет предыдущую корзину в аккаунте."
            : "Войдите, чтобы сохранить корзину и открыть её на другом устройстве."
        }}
      </p>
    </div>
    <div v-if="signedIn" class="account-cart-actions">
      <button
        class="secondary"
        :disabled="pending || !items.length"
        @click="saveAccount"
      >
        Сохранить в аккаунт
      </button>
      <button class="text-button" :disabled="pending" @click="loadAccount">
        Загрузить из аккаунта
      </button>
    </div>
    <NuxtLink v-else-if="!checking" to="/account" class="text-button"
      >Войти в аккаунт</NuxtLink
    >
    <p v-if="pending" role="status" class="muted">
      <span class="spinner" /> Подождите…
    </p>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
    <AppModal
      v-if="loaded"
      title="Загрузить корзину из аккаунта?"
      @close="loaded = null"
    >
      <p v-if="canLoad">
        {{ loaded.length }} позиций заменят текущую корзину. Сохранённые списки
        останутся.
      </p>
      <p v-else class="error">
        В аккаунте слишком большая корзина. Сейчас Nabo сравнивает до 20
        позиций, не более 99 упаковок каждой. Текущая корзина сохранена.
      </p>
      <p class="muted">
        Цены проверены для «{{ location.label }}». Недоступные товары останутся
        в списке без цены — их можно заменить.
      </p>
      <template #footer>
        <div class="account-cart-actions">
          <button class="secondary" @click="loaded = null">Отмена</button>
          <button v-if="canLoad" class="primary" @click="apply">
            Загрузить корзину
          </button>
        </div>
      </template>
    </AppModal>
  </section>
</template>
