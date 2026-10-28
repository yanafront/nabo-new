<script setup lang="ts">
import { productTopics } from "~/shared/seo/topics";
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
    <SeoBreadcrumbs
      :entries="[
        { name: 'Главная', path: '/' },
        { name: 'Продукты', path: '/products' },
      ]"
    />
    <nav
      v-if="!replaceId && !query"
      class="seo-links"
      aria-label="Популярные продукты"
    >
      <NuxtLink
        v-for="topic in productTopics"
        :key="topic.slug"
        :to="`/products/${topic.slug}`"
        >{{ topic.name }}</NuxtLink
      >
    </nav>
    <div class="page-heading">
      <div class="products-heading-copy">
        <div class="products-title-row">
          <h1>
            {{ replaceId ? "Выберите замену" : "Поиск продуктов в магазинах" }}
          </h1>
          <details
            class="products-help"
            @keydown.esc="
              ($event.currentTarget as HTMLDetailsElement).open = false
            "
          >
            <summary aria-label="Как работает поиск товаров">
              <AppIcon name="Info" :size="20" />
            </summary>
            <p>
              Найдите товар и сравните предложения во вкладках магазинов.
              Добавляем только то, что выберете вы.
            </p>
          </details>
        </div>
        <p class="muted products-intro">
          Найдите продукты по названию или бренду, сравните цены и наличие в
          магазинах Беларуси. В корзину попадёт только то, что выберете вы.
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
      <VoiceSearchButton
        @result="
          (text) => {
            query = text;
            search(text);
          }
        "
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
      <span class="spinner" /> Ищем во всех магазинах… Иногда нужно чуть больше
      времени 💚
    </div>

    <template v-if="searched">
      <div class="catalog-results-head">
        <h2 :title="searched">«{{ searched }}»</h2>
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
      <AppFeedback v-if="searchError" :message="searchError" />
      <AppFeedback
        v-else-if="errors.length"
        :message="`Не ответили: ${errors.join(', ')}. Остальные результаты доступны.`"
        kind="info"
      />
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
          <StoreBrand :store-id="entry.id" size="compact" />
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
        <div v-if="activeFailed" class="empty-state compact">
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
    <KnownProducts v-if="!searched" />
    <section
      v-if="!searched && !replaceId"
      class="seo-section product-search-guide"
      aria-labelledby="product-search-guide-title"
    >
      <h2 id="product-search-guide-title">
        Где купить продукты и сравнить цены
      </h2>
      <p class="muted">
        Nabo ищет товары в Евроопте, Green, Гиппо, Соседях, Белмаркете и Санте.
        Введите конкретное название: например, «яйца куриные» или «молоко 3,2%».
        Переключайте вкладки магазинов, чтобы выбрать подходящий товар и
        упаковку.
      </p>
      <details>
        <summary>Как купить продукты через Nabo?</summary>
        <p>
          Добавьте товары в корзину, измените количество и сравните набор по
          магазинам. Затем перейдите на сайт выбранной сети. Заказ, оплату и
          доставку оформляет магазин.
        </p>
      </details>
      <details>
        <summary>Почему цена и наличие зависят от адреса?</summary>
        <p>
          Предложения могут различаться в разных точках и зонах доставки.
          Выберите адрес вверху страницы перед поиском. Итоговую цену и условия
          доставки проверьте у магазина перед оплатой.
        </p>
      </details>
      <nav class="seo-links" aria-label="Другие способы найти продукты">
        <NuxtLink to="/stores"
          >Продуктовые магазины рядом и каталоги сетей</NuxtLink
        >
        <NuxtLink to="/recipes">Собрать продукты по рецепту</NuxtLink>
      </nav>
    </section>
  </div>
</template>

<style scoped>
.products-help {
  display: none;
}
@media (max-width: 760px) {
  .products-page {
    margin-top: 16px;
  }
  .products-page :deep(.seo-breadcrumbs) {
    margin-bottom: 10px;
  }
  .products-page > .seo-links {
    gap: 8px 16px;
    margin: 10px 0 16px;
    font-size: 12px;
  }
  .products-page .page-heading {
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 14px;
    flex-wrap: wrap;
  }
  .products-heading-copy {
    flex: 1 1 220px;
    min-width: 0;
  }
  .products-title-row {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    position: relative;
  }
  .products-title-row h1 {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: 23px;
    line-height: 1.2;
  }
  .products-intro {
    display: none;
  }
  .products-help {
    display: block;
    flex-shrink: 0;
  }
  .products-help summary {
    display: grid;
    place-items: center;
    width: 44px;
    min-height: 44px;
    margin: -7px -8px 0 0;
    color: var(--muted);
    list-style: none;
    border-radius: 50%;
  }
  .products-help summary::-webkit-details-marker {
    display: none;
  }
  .products-help[open] summary {
    color: var(--ink);
  }
  .products-help p {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 30;
    width: min(320px, calc(100vw - 40px));
    padding: 14px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
    box-shadow: 0 6px 24px rgb(15 15 16 / 10%);
    font-size: 13px;
    line-height: 1.5;
  }
  .page-heading > .secondary {
    min-height: 36px;
    padding: 8px 12px;
    font-size: 12px;
  }
  .products-search {
    gap: 6px;
    padding: 4px 6px;
    margin-bottom: 8px;
    border-radius: 16px;
  }
  .products-search > svg {
    width: 18px;
    height: 18px;
    margin-left: 4px;
  }
  .products-search > input {
    font-size: 16px;
    padding: 8px 0;
  }
  .products-search > .primary {
    min-height: 44px;
    padding: 10px 12px;
  }
  .catalog-chips {
    gap: 6px;
    margin: 8px 0 12px;
  }
  .catalog-chips button {
    min-height: 40px;
    padding: 7px 12px;
  }
  .products-progress {
    min-height: 32px;
    font-size: 12px;
  }
  .catalog-results-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    margin: 14px 0 10px;
  }
  .catalog-results-head h2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    width: 100%;
    min-width: 0;
    margin: 0;
    font-size: 18px;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }
  .catalog-results-head > span {
    width: 100%;
    font-size: 12px;
    line-height: 1.4;
  }
  .product-store-tabs {
    gap: 6px;
    padding-bottom: 8px;
    margin-bottom: 0;
  }
  .product-store-tabs button {
    min-height: 44px;
    padding: 8px 10px;
    gap: 6px;
  }
  .product-store-results {
    margin-top: 10px;
  }
  .product-store-results > .muted {
    margin-bottom: 10px;
    font-size: 12px;
  }
  .catalog-product-grid {
    gap: 8px;
  }
  .catalog-product-grid :deep(.catalog-product-card) {
    padding: 10px;
  }
  .catalog-product-grid :deep(.catalog-product-link > .product-image),
  .catalog-product-grid :deep(.catalog-product-link > .product-emoji) {
    height: 112px;
    min-height: 112px;
    max-height: 112px;
    margin-bottom: 8px;
  }
  .catalog-product-grid :deep(.catalog-product-copy h3) {
    line-height: 1.4;
    margin-bottom: 6px;
  }
  .catalog-product-grid :deep(.catalog-product-copy p) {
    margin-bottom: 8px;
  }
}
</style>
