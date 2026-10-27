<script setup lang="ts">
import { retailStores, type SearchResult, type StoreId } from "~/shared/yandex";

const route = useRoute();
const store = computed(() =>
  retailStores.find((item) => item.id === route.params.storeId),
);
if (!store.value)
  throw createError({ statusCode: 404, statusMessage: "Магазин не найден" });

usePageSeo(() => ({
  title: `${store.value?.name} — поиск продуктов и цены | Nabo`,
  description: `Товары ${store.value?.name}: найдите продукты, проверьте цены и сравните корзину с другими магазинами Беларуси.`,
}));
const { location } = useRetail();
const { searchProducts } = useApi();
const query = ref(typeof route.query.q === "string" ? route.query.q : "молоко");
const result = ref<SearchResult | null>(null);
const pending = ref(false);
const error = ref("");
const visibleCount = ref(24);
let controller: AbortController | undefined;
const popular = ["Молоко", "Яйца", "Сметана", "Картофель", "Яблоки", "Бананы"];

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
    const response = await searchProducts(
      { query: value, storeId: store.value!.id, location: location.value },
      current.signal,
    );
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
    <SeoBreadcrumbs
      :entries="[
        { name: 'Главная', path: '/' },
        { name: 'Магазины', path: '/stores' },
        { name: store!.name, path: `/stores/${store!.id}` },
      ]"
    />
    <NuxtLink to="/stores" class="back-link"
      ><AppIcon name="ArrowLeft" :size="16" /> Все магазины</NuxtLink
    >
    <div class="catalog-store-head">
      <div>
        <h1><StoreBrand :store-id="store!.id" size="large" /></h1>
        <p>Поиск продуктов и цены · {{ location.label }}</p>
      </div>
    </div>
    <NearbyStoresLink :store-id="store!.id" />
    <form class="catalog-search" @submit.prevent="search()">
      <AppIcon name="Search" />
      <input
        v-model="query"
        aria-label="Поиск по каталогу"
        placeholder="Название продукта или бренд"
        maxlength="160"
      />
      <VoiceSearchButton
        @result="
          (text) => {
            query = text;
            search(text);
          }
        "
      />
      <button class="primary" type="submit" :disabled="pending">Найти</button>
    </form>
    <p class="seo-intro muted">
      Проверьте продукты и наличие по адресу доставки. Минимальную сумму заказа,
      стоимость и зону доставки уточняйте на сайте магазина — Nabo не оформляет
      заказ.
    </p>
    <nav class="seo-links">
      <NuxtLink to="/stores">Сравнить с другими магазинами</NuxtLink
      ><NuxtLink to="/recipes">Подобрать блюдо и продукты</NuxtLink>
    </nav>
    <KnownProducts :store-id="store!.id" />
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
      <AppFeedback
        :message="error"
        action-label="Повторить"
        @action="search()"
      />
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
