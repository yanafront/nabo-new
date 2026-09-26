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
} = useBasket();
const { resolve, resolving, resolveError } = useRecipeBasket();
const picker = ref(false);
const replaceId = ref<string>();
function openPicker(id?: string) {
  replaceId.value = id;
  picker.value = true;
}
</script>
<template>
  <div class="inner-page">
    <NuxtLink to="/" class="back-link"
      ><AppIcon name="ArrowLeft" :size="16" /> К идеям</NuxtLink
    >
    <div class="page-heading">
      <div>
        <div class="eyebrow small"></div>
        <h1>{{ title }}</h1>
        <p class="muted">{{ items.length }} позиций</p>
      </div>
      <button class="secondary" :disabled="!items.length" @click="save">
        <AppIcon name="Heart" :size="18" /> Сохранить
      </button>
    </div>
    <div v-if="items.length" class="basket-layout">
      <section class="panel">
        <div class="panel-heading">
          <h2>Ваша корзина</h2>
          <span class="muted">Количество упаковок</span>
        </div>
        <ProductRow
          v-for="row in rows"
          :key="row.productId"
          :product="row.product"
          :quantity="row.quantity"
          @change="change(row.productId, $event)"
          @remove="remove(row.productId)"
          @replace="openPicker(row.productId)"
        /><button class="add-product" @click="openPicker()">
          <AppIcon name="Plus" /> Добавить продукт
        </button>
        <p class="basket-footnote">
          Покупаем целые упаковки. Соль, масло и специи проверьте дома.
        </p>
      </section>
      <aside class="basket-actions">
        <NuxtLink to="/compare" class="primary basket-compare"
          >Сравнить магазины <AppIcon name="ArrowRight" :size="18"
        /></NuxtLink>
        <small class="muted">4 магазина · без доставки и сборов</small>
      </aside>
    </div>
    <div v-else class="empty-state">
      <span>🧺</span>
      <h2>Здесь начинается что-то вкусное</h2>
      <p>Добавьте продукты или расскажите, что хотите приготовить.</p>
      <button class="primary" @click="openPicker()">
        Добавить продукт <AppIcon name="Plus" /></button
      ><NuxtLink to="/" class="text-button">Выбрать блюдо</NuxtLink>
    </div>
    <div v-if="pendingIngredients.length" class="basket-notice" role="status">
      Ещё {{ pendingIngredients.length }} ингредиентов можно добавить.
      <button
        class="text-button"
        :disabled="resolving"
        @click="resolve({ title, items: pendingIngredients }, undefined, true)"
      >
        {{ resolving ? "Подбираем…" : "Подобрать товары" }}
      </button>
      <p v-if="resolveError" class="error">{{ resolveError }}</p>
    </div>
    <div v-if="unresolved.length" class="basket-notice" role="status">
      Не удалось подобрать: {{ unresolved.join(", ") }}. Эти позиции не включены
      в корзину.
      <button class="text-button" @click="openPicker()">Найти вручную</button>
      <button class="text-button" @click="unresolved = []">Скрыть</button>
    </div>
    <LazyProductPicker
      v-if="picker"
      :replace-id="replaceId"
      @close="picker = false"
    />
  </div>
</template>
