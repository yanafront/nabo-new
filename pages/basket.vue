<script setup lang="ts">
const { items, title, save, saving, clear, unresolved, pendingIngredients } =
  useBasket();
const { retryMissing, resolving, resolveError } = useRecipeBasket();
const cartSync = useCartSync();
onNuxtReady(() => {
  if (cartSync.state.value !== "loading") void cartSync.refresh();
});
const confirmClear = ref(false);
const hasContent = computed(
  () =>
    items.value.length > 0 ||
    unresolved.value.length > 0 ||
    pendingIngredients.value.length > 0,
);
async function clearBasket() {
  if (resolving.value || cartSync.state.value === "saving") return;
  if (!(await clear())) return;
  resolveError.value = "";
  confirmClear.value = false;
}
</script>
<template>
  <div class="inner-page basket-page">
    <div class="page-heading basket-heading">
      <div>
        <h1>Корзина</h1>
        <p v-if="hasContent" class="muted basket-context">
          {{ items.length }} позиций · {{ title }}
        </p>
      </div>
      <div v-if="hasContent" class="basket-heading-actions">
        <NuxtLink to="/products" class="text-button"
          ><AppIcon name="Plus" :size="16" /> Добавить товары</NuxtLink
        >
        <button
          class="basket-clear-button"
          :disabled="resolving || cartSync.state.value === 'saving'"
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
    <div
      v-if="items.length && (unresolved.length || pendingIngredients.length)"
      class="basket-notice"
      role="status"
    >
      <strong
        >Нужно найти: {{ unresolved.join(", ") || "ингредиенты рецепта" }}. В
        сравнение не включены.</strong
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
        {{ resolving ? "Подбираем…" : "Подобрать" }}
      </button>
      <p v-if="resolveError" class="error">{{ resolveError }}</p>
    </div>
    <BasketStores v-if="items.length" />
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
      <p v-if="cartSync.error.value" role="alert" class="error">
        {{ cartSync.error.value }}
      </p>
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
            :disabled="resolving || cartSync.state.value === 'saving'"
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
