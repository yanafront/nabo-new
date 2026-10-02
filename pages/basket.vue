<script setup lang="ts">
const {
  items,
  title,
  rows,
  remove,
  change,
  save,
  clear,
  unresolved,
  pendingIngredients,
} = useBasket();
const { retryMissing, resolving, resolveError } = useRecipeBasket();
const { refreshPrices, pricesPending, pricesError } = useCartPrices();
const confirmClear = ref(false);
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
    <div class="flow-steps">
      <NuxtLink to="/products">01 · Выбор</NuxtLink
      ><span class="active">02 · Корзина</span><span>03 · Где выгоднее</span>
    </div>
    <div class="page-heading">
      <div>
        <span class="eyebrow">ПРОВЕРЬТЕ СПИСОК</span>
        <h1>{{ title }}</h1>
        <p class="muted">
          {{
            items.length
              ? `${quantityLabel(items.length, "позиция", "позиции", "позиций")} · ${quantityLabel(count, "упаковка", "упаковки", "упаковок")}`
              : "Все ваши покупки в одном месте"
          }}
        </p>
      </div>
      <div v-if="hasContent" class="basket-heading-actions">
        <NuxtLink to="/recipes?add=1" class="secondary">
          <AppIcon name="Plus" :size="18" /> Добавить блюдо
        </NuxtLink>
        <button v-if="items.length" class="secondary" @click="save">
          <AppIcon name="Heart" :size="18" /> Сохранить список
        </button>
        <button
          class="text-button"
          :disabled="resolving || pricesPending"
          @click="confirmClear = true"
        >
          <AppIcon name="Trash2" :size="18" /> Очистить корзину
        </button>
      </div>
    </div>
    <AccountCart />
    <p v-if="pricesError" class="error" role="alert">{{ pricesError }}</p>
    <p v-if="unpriced" class="info-note" role="status">
      Для {{ unpriced }} позиций цена не подтверждена. Они не включены в сумму —
      обновите цены или замените товар.
    </p>
    <div
      v-if="unresolved.length || pendingIngredients.length"
      class="basket-notice"
      role="status"
    >
      <strong>Некоторые продукты ещё нужно найти</strong>
      <p v-if="unresolved.length">
        {{ unresolved.join(", ") }}. В сумму не включены.
      </p>
      <NuxtLink
        class="text-button"
        :to="{
          path: '/products',
          query: unresolved[0] ? { q: unresolved[0] } : {},
        }"
        >Найти вручную</NuxtLink
      ><button class="text-button" :disabled="resolving" @click="retryMissing">
        {{ resolving ? "Подбираем…" : "Подобрать недостающие" }}
      </button>
      <p v-if="resolveError" class="error">{{ resolveError }}</p>
    </div>
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
      <aside class="basket-summary">
        <span class="eyebrow">ВАША КОРЗИНА</span>
        <div class="summary-total">
          <span>{{
            quantityLabel(count, "упаковка", "упаковки", "упаковок")
          }}</span
          ><strong>{{ money(total) }} <small>BYN</small></strong>
        </div>
        <p>
          Сумма по подтверждённым ценам. При обновлении проверяем выбранные
          товары без автоматической замены.
        </p>
        <div class="basket-actions">
          <NuxtLink to="/compare" class="primary full"
            >Сравнить в магазинах
            <AppIcon name="ArrowRight" :size="18" /></NuxtLink
          ><small>6 магазинов · без доставки и сборов</small>
        </div>
        <details class="trust-details">
          <summary>Как сравниваем цены</summary>
          <p>
            Ищем выбранные товары и подходящие замены. Разные бренды и упаковки
            проверяйте перед покупкой. Цены могут измениться у магазина.
          </p>
        </details>
      </aside>
    </div>
    <div v-else class="empty-state">
      <span class="empty-icon"
        ><AppIcon name="ShoppingBasket" :size="36"
      /></span>
      <h2>С чего начнём покупки?</h2>
      <p>Выберите товары вручную или добавьте ингредиенты из рецепта.</p>
      <NuxtLink to="/products" class="primary"
        >Найти товары <AppIcon name="ArrowRight" /></NuxtLink
      ><NuxtLink to="/recipes" class="text-button"> Выбрать рецепт</NuxtLink>
    </div>
    <AppModal
      v-if="confirmClear"
      title="Очистить корзину?"
      @close="confirmClear = false"
    >
      <p>Удалим все товары и недостающие ингредиенты из текущей корзины.</p>
      <p class="muted">Сохранённые списки и корзина в аккаунте останутся.</p>
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
