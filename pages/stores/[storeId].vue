<script setup lang="ts">
import { retailStores, type SearchResult, type StoreId } from "~/shared/yandex";

const route = useRoute();
const store = computed(() =>
  retailStores.find((item) => item.id === route.params.storeId),
);
if (!store.value)
  throw createError({ statusCode: 404, statusMessage: "Магазин не найден" });

const { location } = useRetail();
const { searchProducts } = useApi();
const query = ref(typeof route.query.q === "string" ? route.query.q : "молоко");
const result = ref<SearchResult | null>(null);
const pending = ref(false);
const error = ref("");
const visibleCount = ref(24);
let controller: AbortController | undefined;
const popular = ["Молоко", "Овощи", "Хлеб", "Яйца", "Сыр"];

async function search(value = query.value) {
  if (value.trim().length < 2) return;
  query.value = value;
  visibleCount.value = 24;
  controller?.abort();
  const current = new AbortController();
  controller = current;
  pending.value = true;
  error.value = "";
  try {
    const response = await searchProducts({ query: value, storeId: store.value!.id, location: location.value }, current.signal);
    if (controller !== current || current.signal.aborted) return;
    result.value = response;
    if (result.value.status === "error")
      error.value = result.value.error || "Поиск недоступен";
  } catch {
    if (controller === current && !current.signal.aborted)
      error.value = "Не удалось загрузить каталог. Повторите поиск.";
  } finally {
    if (controller === current) pending.value = false;
  }
}

const displayedProducts = computed(() =>
  (result.value?.products || []).slice(0, visibleCount.value),
);

watch(location, () => search(), { deep: true });
onMounted(() => search());
onBeforeUnmount(() => controller?.abort());
</script>

<template>
  <div class="inner-page catalog-page">
    <NuxtLink to="/stores" class="back-link"
      ><AppIcon name="ArrowLeft" :size="16" /> Все магазины</NuxtLink
    >
    <div class="catalog-store-head">
      <span class="store-logo large" :style="{ background: store!.color }">{{
        store!.letter
      }}</span>
      <div>
        <h1>{{ store!.name }}</h1>
        <p>Каталог · {{ location.label }}</p>
      </div>
    </div>
    <form class="catalog-search" @submit.prevent="search()">
      <AppIcon name="Search" />
      <input
        v-model="query"
        aria-label="Поиск по каталогу"
        placeholder="Название продукта или бренд"
        maxlength="160"
      />
      <button class="primary" type="submit" :disabled="pending">Найти</button>
    </form>
    <div class="catalog-chips" aria-label="Популярные категории">
      <button
        v-for="item in popular"
        :key="item"
        :class="{ active: query.toLowerCase() === item.toLowerCase() }"
        @click="search(item)"
      >
        {{ item }}
      </button>
    </div>
    <div v-if="pending" class="catalog-loading" role="status">
      <span class="spinner" /> Загружаем товары…
    </div>
    <div v-else-if="error" class="catalog-error">
      <p class="error" role="alert">{{ error }}</p>
      <button class="secondary" @click="search()">Повторить</button>
    </div>
    <template v-else>
      <div class="catalog-results-head">
        <h2>Результаты</h2>
        <span>{{ result?.products.length || 0 }} товаров</span>
      </div>
      <div v-if="result?.products.length" class="catalog-product-grid">
        <CatalogProductCard
          v-for="product in displayedProducts"
          :key="product.id"
          :product="product"
        />
      </div>
      <button
        v-if="result && visibleCount < result.products.length"
        class="secondary catalog-more"
        @click="visibleCount += 24"
      >
        Показать ещё {{ Math.min(24, result.products.length - visibleCount) }}
      </button>
      <div v-if="!result?.products.length" class="empty-state compact">
        <h2>Ничего не нашли</h2>
        <p>Попробуйте другое название или категорию.</p>
      </div>
    </template>
  </div>
</template>
