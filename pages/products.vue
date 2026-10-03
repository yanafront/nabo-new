<script setup lang="ts">
import {
  retailStores,
  type RetailProduct,
  type StoreId,
} from "~/shared/yandex";

const route = useRoute();
const router = useRouter();
const { location } = useRetail();
const { searchAllProducts } = useApi();
const { items } = useBasket();
const query = ref(typeof route.query.q === "string" ? route.query.q : "");
const searched = ref(query.value);
const replaceId = computed(() =>
  typeof route.query.replace === "string" ? route.query.replace : undefined,
);
const groups = ref<Array<{ storeId: StoreId; products: RetailProduct[] }>>([]);
const errors = ref<string[]>([]);
const searchError = ref("");
const loading = ref<StoreId[]>([]);
const pending = computed(() => loading.value.includes(activeStore.value));
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
const popular = ["Молоко", "Яйца", "Сметана", "Картофель", "Яблоки", "Бананы"];

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
  searchError.value = "";
  loading.value = [];
  router.replace({
    query: {
      q: clean,
      store: activeStore.value,
      ...(replaceId.value ? { replace: replaceId.value } : {}),
    },
  });
  loading.value = retailStores.map((store) => store.id);
  const point = { ...location.value };
  try {
    const result = await searchAllProducts(
      { query: clean, location: point },
      current.signal,
    );
    if (controller !== current || current.signal.aborted) return;
    groups.value = result.stores
      .filter((result) => result.status === "ok")
      .map((result) => ({
        storeId: result.storeId,
        products: result.products,
      }));
    errors.value = retailStores
      .filter(
        (entry) =>
          !result.stores.some(
            (result) => result.storeId === entry.id && result.status === "ok",
          ),
      )
      .map((entry) => entry.name);
  } catch (e: any) {
    if (controller === current && !current.signal.aborted) {
      errors.value = retailStores.map((entry) => entry.name);
      searchError.value =
        e.statusCode === 429
          ? "Слишком много запросов. Подождите минуту и повторите поиск."
          : "Не удалось выполнить поиск. Повторите попытку.";
    }
  } finally {
    if (controller === current) loading.value = [];
  }
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
        <h1>{{ replaceId ? "Выберите замену" : "Товары" }}</h1>
        <p class="muted">
          Найдите товар и сравните предложения во вкладках магазинов. Добавляем
          только то, что выберете вы.
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
        placeholder="Например, сметана"
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
      <span class="spinner" /> Ищем во всех магазинах…
    </div>

    <template v-if="searched">
      <div class="catalog-results-head">
        <h2>«{{ searched }}»</h2>
        <span>{{
          pending
            ? "Ищем…"
            : searchError
              ? "Поиск не завершён"
              : errors.length
                ? `${total} товаров в ответивших магазинах`
                : `${total} товаров во всех магазинах`
        }}</span>
      </div>
      <p v-if="searchError" class="error" role="alert">{{ searchError }}</p>
      <p v-else-if="errors.length" class="info-note">
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
              .length ??
            (errors.includes(entry.name)
              ? "!"
              : loading.includes(entry.id)
                ? "…"
                : "—")
          }}</span>
        </button>
      </div>
      <section
        :id="`store-panel-${activeStore}`"
        :key="activeStore"
        class="product-store-results"
        role="tabpanel"
        :aria-labelledby="`store-tab-${activeStore}`"
        :aria-busy="pending"
      >
        <p
          v-if="!activeGroup && pending && !activeFailed"
          role="status"
          class="products-progress"
        >
          <span class="spinner" />Ищем во всех магазинах…
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
      <div
        v-if="!pending && !total && !errors.length"
        class="empty-state compact"
      >
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
