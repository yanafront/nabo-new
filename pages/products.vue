<script setup lang="ts">
import {
  retailStores,
  type RetailProduct,
  type SearchResult,
  type StoreId,
} from "~/shared/yandex";

const route = useRoute();
const router = useRouter();
const { location } = useRetail();
const { searchProducts } = useApi();
const { items } = useBasket();
const query = ref(typeof route.query.q === "string" ? route.query.q : "");
const searched = ref(query.value);
const replaceId = computed(() =>
  typeof route.query.replace === "string" ? route.query.replace : undefined,
);
const groups = ref<Array<{ storeId: StoreId; products: RetailProduct[] }>>([]);
const errors = ref<string[]>([]);
const pending = ref(false);
const completed = ref(0);
let controller: AbortController | undefined;
const activeStore = ref<StoreId>(
  retailStores.find((entry) => entry.id === route.query.store)?.id ||
    retailStores[0].id,
);
const pageSize = 12;
const shown = ref<Partial<Record<StoreId, number>>>({});
const sentinel = ref<HTMLElement>();
let observer: IntersectionObserver | undefined;
const activeGroup = computed(() =>
  groups.value.find((group) => group.storeId === activeStore.value),
);
const visibleProducts = computed(
  () =>
    activeGroup.value?.products.slice(
      0,
      shown.value[activeStore.value] || pageSize,
    ) || [],
);
const hasMore = computed(
  () =>
    visibleProducts.value.length < (activeGroup.value?.products.length || 0),
);
const activeFailed = computed(() =>
  errors.value.includes(store(activeStore.value).name),
);
function loadMore() {
  shown.value[activeStore.value] =
    (shown.value[activeStore.value] || pageSize) + pageSize;
}
function selectStore(id: StoreId) {
  activeStore.value = id;
  router.replace({ query: { ...route.query, store: id } });
}
function tabKey(event: KeyboardEvent, index: number) {
  let next = index;
  if (event.key === "ArrowRight") next = (index + 1) % retailStores.length;
  else if (event.key === "ArrowLeft")
    next = (index + retailStores.length - 1) % retailStores.length;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = retailStores.length - 1;
  else return;
  event.preventDefault();
  selectStore(retailStores[next]!.id);
  const buttons = (
    event.currentTarget as HTMLElement
  ).parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
  buttons?.[next]?.focus();
}
watch(
  [sentinel, activeStore, hasMore],
  () => {
    observer?.disconnect();
    if (!sentinel.value || !hasMore.value) return;
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && hasMore.value)
          loadMore();
      },
      { rootMargin: "240px" },
    );
    observer.observe(sentinel.value);
  },
  { flush: "post" },
);
const popular = ["Молоко", "Яйца", "Хлеб", "Сыр", "Овощи", "Фрукты"];

const total = computed(() =>
  groups.value.reduce((sum, group) => sum + group.products.length, 0),
);
const replacing = computed(() =>
  replaceId.value
    ? items.value.find((item) => item.productId === replaceId.value)
    : undefined,
);
const store = (id: StoreId) => retailStores.find((entry) => entry.id === id)!;

async function search(value = query.value) {
  const clean = value.trim();
  if (clean.length < 2) return;
  query.value = clean;
  searched.value = clean;
  controller?.abort();
  const current = new AbortController();
  controller = current;
  groups.value = [];
  shown.value = {};
  errors.value = [];
  completed.value = 0;
  pending.value = true;
  router.replace({
    query: {
      q: clean,
      store: activeStore.value,
      ...(replaceId.value ? { replace: replaceId.value } : {}),
    },
  });
  const point = { ...location.value };
  await Promise.all(
    retailStores.map(async (entry) => {
      try {
        const result: SearchResult = await searchProducts(
          { storeId: entry.id, query: clean, location: point },
          current.signal,
        );
        if (controller !== current || current.signal.aborted) return;
        if (result.status === "ok") {
          groups.value = [
            ...groups.value,
            {
              storeId: entry.id,
              products: result.products,
            },
          ].sort(
            (a, b) =>
              retailStores.findIndex((item) => item.id === a.storeId) -
              retailStores.findIndex((item) => item.id === b.storeId),
          );
        } else errors.value = [...errors.value, entry.name];
      } catch {
        if (!current.signal.aborted)
          errors.value = [...errors.value, entry.name];
      } finally {
        if (controller === current) completed.value++;
      }
    }),
  );
  if (controller === current) pending.value = false;
}

watch(location, () => searched.value && search(searched.value), { deep: true });
onMounted(() => searched.value && search(searched.value));
onBeforeUnmount(() => {
  controller?.abort();
  observer?.disconnect();
});
</script>

<template>
  <div class="inner-page products-page">
    <div class="page-heading">
      <div>
        <span class="eyebrow">ВЫБОР ВСЕГДА ЗА ВАМИ</span>
        <h1>{{ replaceId ? "Выберите замену" : "Товары" }}</h1>
        <p class="muted">
          Ищем конкретные товары сразу в нескольких магазинах. Добавляем только
          то, что выберете вы.
        </p>
      </div>
      <NuxtLink v-if="items.length" to="/basket" class="secondary">
        Корзина · {{ items.length }}
      </NuxtLink>
    </div>

    <p v-if="replacing" class="info-note">
      Вы заменяете «{{ replacing.product?.name }}». Выберите новую позицию — она
      сразу появится в корзине вместо текущей.
    </p>

    <form class="catalog-search products-search" @submit.prevent="search()">
      <AppIcon name="Search" />
      <input
        v-model="query"
        aria-label="Поиск товаров"
        placeholder="Молоко, яйца, авокадо…"
        maxlength="160"
        autofocus
      />
      <button
        class="primary"
        type="submit"
        :disabled="pending || query.trim().length < 2"
      >
        Найти
      </button>
    </form>

    <div class="catalog-chips" aria-label="Популярные товары">
      <button
        v-for="item in popular"
        :key="item"
        :class="{ active: searched.toLowerCase() === item.toLowerCase() }"
        @click="search(item)"
      >
        {{ item }}
      </button>
    </div>

    <div v-if="pending" class="products-progress" role="status">
      <span class="spinner" /> Проверяем магазины: {{ completed }} из
      {{ retailStores.length }}
    </div>

    <template v-if="searched">
      <div class="catalog-results-head">
        <h2>«{{ searched }}»</h2>
        <span>{{ pending ? "Ищем…" : `${total} товаров` }}</span>
      </div>
      <p v-if="errors.length" class="info-note">
        Не ответили: {{ errors.join(", ") }}. Остальные результаты доступны.
      </p>
      <div class="product-store-tabs" role="tablist" aria-label="Магазины">
        <button
          v-for="(entry, index) in retailStores"
          :id="`store-tab-${entry.id}`"
          :key="entry.id"
          type="button"
          role="tab"
          :aria-selected="activeStore === entry.id"
          :aria-controls="`store-panel-${entry.id}`"
          :tabindex="activeStore === entry.id ? 0 : -1"
          :class="{ active: activeStore === entry.id }"
          @click="selectStore(entry.id)"
          @keydown="tabKey($event, index)"
        >
          {{ entry.name }}
          <span>{{
            groups.find((group) => group.storeId === entry.id)?.products
              .length ?? (errors.includes(entry.name) ? "!" : "…")
          }}</span>
        </button>
      </div>
      <section
        :id="`store-panel-${activeStore}`"
        :key="activeStore"
        class="product-store-results"
        role="tabpanel"
        :aria-labelledby="`store-tab-${activeStore}`"
        :aria-busy="!activeGroup && pending"
      >
        <p
          v-if="!activeGroup && pending && !activeFailed"
          role="status"
          class="products-progress"
        >
          <span class="spinner" />Ищем в {{ store(activeStore).name }}…
        </p>
        <div v-else-if="activeFailed" class="empty-state compact">
          <h2>Магазин не ответил</h2>
          <p>Выберите другую вкладку или повторите поиск.</p>
          <button
            class="secondary"
            :disabled="pending"
            @click="search(searched)"
          >
            Повторить поиск
          </button>
        </div>
        <template v-else-if="activeGroup?.products.length">
          <p class="muted">
            {{ activeGroup.products.length }} товаров · цена за упаковку
          </p>
          <div class="catalog-product-grid compact-grid">
            <CatalogProductCard
              v-for="product in visibleProducts"
              :key="product.id"
              :product="product"
              :replace-id="replaceId"
            />
          </div>
          <div v-if="hasMore" ref="sentinel" class="products-load-more">
            <span class="muted"
              >Показано {{ visibleProducts.length }} из
              {{ activeGroup.products.length }}</span
            >
            <button class="secondary" @click="loadMore">Показать ещё</button>
          </div>
          <p v-else class="products-list-end muted">
            Все {{ activeGroup.products.length }} товаров показаны
          </p>
        </template>
        <div v-else-if="activeGroup" class="empty-state compact">
          <h2>В этом магазине ничего не найдено</h2>
          <p>Посмотрите другие магазины или измените запрос.</p>
        </div>
      </section>
      <div v-if="!pending && !total" class="empty-state compact">
        <h2>Товар не найден</h2>
        <p>Попробуйте более общее название, например «молоко» вместо бренда.</p>
      </div>
    </template>

    <div v-else class="product-start panel">
      <AppIcon name="Search" :size="28" />
      <div>
        <h2>Найдите конкретный продукт</h2>
        <p>Покажем доступные упаковки и цены отдельно для каждого магазина.</p>
      </div>
    </div>
  </div>
</template>
