<script setup lang="ts">
const {
  items,
  title,
  rows,
  remove,
  change,
  save,
  unresolved,
  pendingIngredients,
  setPreference,
} = useBasket();
const { resolve, resolving, resolveError } = useRecipeBasket();
const picker = ref(false);
const replaceId = ref<string>();
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
function openPicker(id?: string) {
  replaceId.value = id;
  picker.value = true;
}
</script>
<template>
  <div class="inner-page basket-page">
    <div class="flow-steps">
      <NuxtLink to="/">01 · Список</NuxtLink
      ><span class="active">02 · Корзина</span><span>03 · Где дешевле</span>
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
      <button v-if="items.length" class="secondary" @click="save">
        <AppIcon name="Heart" :size="18" /> Сохранить
      </button>
    </div>
    <div
      v-if="unresolved.length || pendingIngredients.length"
      class="basket-notice"
      role="status"
    >
      <strong>Некоторые продукты ещё нужно найти</strong>
      <p v-if="unresolved.length">
        {{ unresolved.join(", ") }}. В сумму не включены.
      </p>
      <button class="text-button" @click="openPicker()">Найти вручную</button
      ><button
        v-if="pendingIngredients.length"
        class="text-button"
        :disabled="resolving"
        @click="resolve({ title, items: pendingIngredients }, undefined, true)"
      >
        {{
          resolving
            ? "Подбираем…"
            : `Подобрать ещё ${pendingIngredients.length}`
        }}
      </button>
      <p v-if="resolveError" class="error">{{ resolveError }}</p>
    </div>
    <div v-if="items.length" class="basket-layout">
      <section class="basket-list panel">
        <div class="panel-heading">
          <h2>Ваши продукты</h2>
          <span>Цена при выборе</span>
        </div>
        <template v-for="row in rows" :key="row.productId"
          ><ProductRow
            :product="row.product"
            :quantity="row.quantity"
            :required="row.required"
            :allow-replacement="row.allowReplacement"
            @change="change(row.productId, $event)"
            @remove="remove(row.productId)"
            @replace="openPicker(row.productId)"
            @preference="
              (key, value) => setPreference(row.productId, key, value)
            " /><LazyProductPicker
            v-if="picker && replaceId === row.productId"
            inline
            :replace-id="replaceId"
            @close="picker = false"
        /></template>
        <button class="add-product" @click="openPicker()">
          <AppIcon name="Plus" :size="20" /> Добавить продукт
        </button>
        <LazyProductPicker
          v-if="picker && !replaceId"
          inline
          @close="picker = false"
        />
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
          По ценам при добавлении. Проверим, где весь список обойдётся дешевле.
        </p>
        <div class="basket-actions">
          <NuxtLink to="/compare" class="primary full"
            >Найти дешевле <AppIcon name="ArrowRight" :size="18" /></NuxtLink
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
      <p>Напишите блюдо или список продуктов — соберём корзину для вас.</p>
      <NuxtLink to="/" class="primary"
        >Собрать корзину <AppIcon name="ArrowRight" /></NuxtLink
      ><button class="text-button" @click="openPicker()">
        Добавить продукты вручную</button
      ><LazyProductPicker v-if="picker" @close="picker = false" />
    </div>
  </div>
</template>
