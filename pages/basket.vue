<script setup lang="ts">
import { providerName } from "~/shared/yandex";
const {
  items,
  title,
  rows,
  remove,
  change,
  save,
  saving,
  clear,
  unresolved,
  pendingIngredients,
} = useBasket();
const { retryMissing, resolving, resolveError } = useRecipeBasket();
const { refreshPrices, pricesPending, pricesError } = useCartPrices();
const cartSync = useCartSync();
const confirmClear = ref(false);
const stores = computed(() =>
  [
    ...new Set(rows.value.map((row) => row.product.storeId).filter(Boolean)),
  ].map((id) => providerName(id!)),
);
const hasContent = computed(
  () =>
    items.value.length > 0 ||
    unresolved.value.length > 0 ||
    pendingIngredients.value.length > 0,
);
function clearBasket() {
  if (resolving.value || pricesPending.value) return;
  clear();
  resolveError.value = "";
  pricesError.value = "";
  confirmClear.value = false;
}
const unpriced = computed(
  () => rows.value.filter((row) => row.product.price === null).length,
);
const total = computed(
  () =>
    rows.value.reduce(
      (sum, row) =>
        sum + Math.round((row.product.price || 0) * 100) * row.quantity,
      0,
    ) / 100,
);
const count = computed(() =>
  rows.value.reduce((sum, row) => sum + row.quantity, 0),
);
function replaceProduct(id: string, name: string) {
  navigateTo({ path: "/products", query: { q: name, replace: id } });
}
</script>
<template>
  <div class="inner-page basket-page">
    <div class="page-heading basket-heading">
      <div>
        <h1>Корзина</h1>
        <p v-if="hasContent" class="muted basket-context">
          {{ title
          }}<span v-if="stores.length"> · {{ stores.join(" · ") }}</span>
        </p>
      </div>
      <div v-if="hasContent" class="basket-heading-actions">
        <NuxtLink to="/products" class="text-button"
          ><AppIcon name="Plus" :size="16" /> Добавить товары</NuxtLink
        >
        <button
          class="basket-clear-button"
          :disabled="resolving || pricesPending"
          @click="confirmClear = true"
        >
          <AppIcon name="Trash2" :size="16" />
          Очистить корзину
        </button>
        <details class="basket-tools">
          <summary>Ещё <AppIcon name="ChevronDown" :size="16" /></summary>
          <div class="basket-tools-menu">
            <NuxtLink to="/recipes?add=1" class="text-button"
              >Добавить блюдо</NuxtLink
            >
            <button
              v-if="items.length"
              class="text-button"
              :disabled="saving"
              @click="save"
            >
              {{ saving ? "Проверяем вход…" : "Сохранить список" }}
            </button>
          </div>
        </details>
      </div>
    </div>
    <p v-if="cartSync.error.value" class="error" role="alert">
      {{ cartSync.error.value }}
      <button class="text-button" @click="cartSync.refresh">Повторить</button>
    </p>
    <div v-if="items.length" class="basket-layout">
      <section class="basket-list panel">
        <div class="panel-heading">
          <h2>Ваши продукты</h2>
          <button
            class="text-button"
            :disabled="pricesPending"
            @click="refreshPrices"
          >
            {{ pricesPending ? "Обновляем…" : "Обновить цены" }}
          </button>
        </div>
        <p v-if="pricesError" class="error" role="alert">{{ pricesError }}</p>
        <p v-if="unpriced" class="basket-price-note" role="status">
          Без цены: {{ unpriced }}. Не включены в итог — замените или обновите.
        </p>
        <div
          v-if="unresolved.length || pendingIngredients.length"
          class="basket-notice"
          role="status"
        >
          <strong
            >Нужно найти:
            {{ unresolved.join(", ") || "ингредиенты рецепта" }}</strong
          >
          <NuxtLink
            class="text-button"
            :to="{
              path: '/products',
              query: unresolved[0] ? { q: unresolved[0] } : {},
            }"
            >Найти вручную</NuxtLink
          >
          <button
            class="text-button"
            :disabled="resolving"
            @click="retryMissing"
          >
            {{ resolving ? "Подбираем…" : "Подобрать" }}
          </button>
          <p v-if="resolveError" class="error">{{ resolveError }}</p>
        </div>
        <template v-for="row in rows" :key="row.productId"
          ><ProductRow
            :product="row.product"
            :quantity="row.quantity"
            @change="change(row.productId, $event)"
            @remove="remove(row.productId)"
            @replace="replaceProduct(row.productId, row.product.name)"
        /></template>
        <NuxtLink to="/products" class="add-product">
          <AppIcon name="Plus" :size="20" /> Добавить продукт
        </NuxtLink>
      </section>
      <aside class="basket-summary" aria-label="Итог корзины">
        <div class="summary-total" aria-live="polite" aria-atomic="true">
          <span
            >{{ quantityLabel(rows.length, "позиция", "позиции", "позиций") }} ·
            {{ quantityLabel(count, "упаковка", "упаковки", "упаковок") }}</span
          >
          <strong
            >{{ money(total) }} <small>BYN</small
            ><span v-if="unpriced" class="summary-partial">
              Без цены: {{ unpriced }}</span
            ></strong
          >
        </div>
        <p class="basket-store-summary">{{ stores.join(" · ") }}</p>
        <div class="basket-actions">
          <NuxtLink to="/compare" class="primary full"
            >Сравнить в магазинах <AppIcon name="ArrowRight" :size="16"
          /></NuxtLink>
        </div>
        <p class="basket-next-step">
          Далее — сравнение и выбор магазина для покупки. Доставка и сборы
          отдельно.
        </p>
      </aside>
    </div>
    <div v-if="hasContent && !items.length" class="basket-notice" role="status">
      <strong
        >Нужно найти:
        {{ unresolved.join(", ") || "ингредиенты рецепта" }}</strong
      >
      <NuxtLink
        class="text-button"
        :to="{
          path: '/products',
          query: unresolved[0] ? { q: unresolved[0] } : {},
        }"
        >Найти вручную</NuxtLink
      >
      <button class="text-button" :disabled="resolving" @click="retryMissing">
        {{ resolving ? "Подбираем…" : "Подобрать недостающие" }}
      </button>
      <p v-if="resolveError" class="error">{{ resolveError }}</p>
    </div>
    <div v-if="!hasContent" class="empty-state">
      <span class="empty-icon"
        ><AppIcon name="ShoppingBasket" :size="36"
      /></span>
      <h2>С чего начнём покупки?</h2>
      <p>Выберите товары вручную или добавьте ингредиенты из рецепта.</p>
      <NuxtLink to="/products" class="primary"
        >Найти товары <AppIcon name="ArrowRight" /></NuxtLink
      ><NuxtLink to="/recipes" class="text-button"> Выбрать рецепт</NuxtLink>
    </div>
    <details class="basket-account-tools">
      <summary>
        Сохранение и восстановление в аккаунте
        <AppIcon name="ChevronDown" :size="16" />
      </summary>
      <AccountCart />
    </details>
    <AppModal
      v-if="confirmClear"
      title="Очистить корзину?"
      @close="confirmClear = false"
    >
      <p>Удалим все товары и недостающие ингредиенты из текущей корзины.</p>
      <p class="muted">
        Сохранённые списки останутся. После входа корзина очистится и в
        аккаунте.
      </p>
      <template #footer>
        <div class="account-cart-actions">
          <button class="secondary" autofocus @click="confirmClear = false">
            Отмена
          </button>
          <button
            class="primary"
            :disabled="resolving || pricesPending"
            @click="clearBasket"
          >
            Очистить корзину
          </button>
        </div>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.basket-clear-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  padding: 4px 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.basket-clear-button:hover:not(:disabled) {
  background: #ffe9e6;
  border-color: var(--muted);
}
.basket-clear-button:disabled {
  opacity: 0.5;
  cursor: wait;
}
@media (max-width: 760px) {
  .basket-clear-button {
    padding: 4px 0;
    font-size: 12px;
  }
}
</style>
