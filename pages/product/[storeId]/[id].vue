<script setup lang="ts">
import {
  productSourceUrl,
  providerName,
  retailStores,
  type RetailProduct,
  type SearchResult,
  type StoreId,
} from "~/shared/yandex";

const route = useRoute();
const storeId = route.params.storeId as StoreId;
const productId = String(route.params.id);
const initialName =
  typeof route.query.name === "string" ? route.query.name : "";
const replaceId =
  typeof route.query.replace === "string" ? route.query.replace : undefined;
const store = retailStores.find((item) => item.id === storeId);
if (!store || !initialName)
  throw createError({ statusCode: 404, statusMessage: "Товар не найден" });

const { location } = useRetail();
const { searchProducts, cachedProduct } = useApi();
const relatedPending = ref(false);
const { addProduct, items } = useBasket();
const product = ref<RetailProduct | null>(null);
type StoreProductGroup = {
  store: (typeof retailStores)[number];
  products: RetailProduct[];
};
const exactRelated = ref<StoreProductGroup[]>([]);
const related = ref<StoreProductGroup[]>([]);
const sameStore = ref<RetailProduct[]>([]);
const pending = ref(true);
const error = ref("");
let controller: AbortController | undefined;

function categoryQuery(name: string) {
  const normalized = name.toLowerCase().replace(/ё/g, "е");
  const known = [
    "молоко",
    "кефир",
    "сметана",
    "творог",
    "йогурт",
    "сыр",
    "масло",
    "яйца",
    "хлеб",
    "батон",
    "картофель",
    "морковь",
    "свекла",
    "капуста",
    "лук",
    "томаты",
    "помидоры",
    "огурцы",
    "бананы",
    "яблоки",
    "макароны",
    "спагетти",
    "рис",
    "гречка",
  ].find((value) => normalized.startsWith(value));
  return (
    known ||
    name
      .split(/[«",(]/)[0]
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .join(" ")
  );
}

const comparableName = (name: string) =>
  name.toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/\s+/g, " ").trim();

function addGroup(target: typeof related, group: StoreProductGroup) {
  target.value = [...target.value, group].sort(
    (a, b) => retailStores.indexOf(a.store) - retailStores.indexOf(b.store),
  );
}

async function load() {
  controller?.abort();
  const current = new AbortController();
  controller = current;
  product.value = cachedProduct(storeId, productId, location.value);
  pending.value = !product.value;
  exactRelated.value = [];
  related.value = [];
  sameStore.value = [];
  relatedPending.value = true;
  error.value = "";
  const point = { ...location.value };
  const valid = () => controller === current && !current.signal.aborted;
  const primary = async () => {
    if (product.value) return;
    try {
      const response = await searchProducts(
        { storeId, query: initialName, location: point },
        current.signal,
      );
      if (!valid()) return;
      product.value =
        response.products.find((item) => item.id === productId) || null;
      if (!product.value)
        error.value =
          response.status === "error"
            ? "Не удалось загрузить товар. Повторите попытку."
            : "Этот товар больше не найден в каталоге.";
    } catch {
      if (valid())
        error.value = "Не удалось загрузить товар. Попробуйте ещё раз.";
    } finally {
      if (valid()) pending.value = false;
    }
  };
  // Start the requested product first. Each secondary store can fail independently.
  const main = primary();
  const query = categoryQuery(initialName);
  const others = retailStores
    .filter((item) => item.id !== storeId)
    .map(async (store) => {
      try {
        const response = await searchProducts(
          { storeId: store.id, query: initialName, location: point },
          current.signal,
        );
        if (!valid() || response.status !== "ok") return;
        const available = response.products.filter((item) => item.available);
        const exact = available
          .filter(
            (item) => comparableName(item.name) === comparableName(initialName),
          )
          .slice(0, 3);
        const similar = available
          .filter(
            (item) => comparableName(item.name) !== comparableName(initialName),
          )
          .slice(0, 3);
        if (exact.length) addGroup(exactRelated, { store, products: exact });
        if (similar.length) addGroup(related, { store, products: similar });
      } catch {
        /* Other retailers must not block the requested product. */
      }
    });
  const localAlternatives = (async () => {
    try {
      const response = await searchProducts(
        { storeId, query, location: point },
        current.signal,
      );
      if (!valid() || response.status !== "ok") return;
      sameStore.value = response.products
        .filter((item) => item.available && item.id !== productId)
        .slice(0, 4);
    } catch {
      /* Similar items are optional. */
    }
  })();
  await main;
  await Promise.all([...others, localAlternatives]);
  if (valid()) relatedPending.value = false;
}

const inCart = computed(
  () =>
    items.value.find((item) => item.productId === `${storeId}:${productId}`)
      ?.quantity || 0,
);
function add() {
  if (product.value && addProduct(product.value, replaceId) && replaceId)
    navigateTo("/basket");
}

watch(location, load, { deep: true });
onMounted(load);
onBeforeUnmount(() => controller?.abort());
</script>

<template>
  <div class="inner-page product-page">
    <NuxtLink
      :to="{
        path: '/products',
        query: {
          q: categoryQuery(initialName),
          ...(replaceId ? { replace: replaceId } : {}),
        },
      }"
      class="back-link"
      ><AppIcon name="ArrowLeft" :size="16" /> К результатам поиска</NuxtLink
    >
    <div v-if="pending" class="catalog-loading panel" role="status">
      <span class="spinner" /> Загружаем товар…
    </div>
    <div v-else-if="error" class="catalog-error panel">
      <p class="error" role="alert">{{ error }}</p>
      <button class="secondary" @click="load">Повторить</button>
    </div>
    <template v-else-if="product">
      <section class="product-detail panel">
        <div class="product-detail-image">
          <ProductImage :src="product.image" />
        </div>
        <div class="product-detail-copy">
          <div class="product-store-line">
            <span class="store-logo" :style="{ background: store!.color }">{{
              store!.letter
            }}</span
            >{{ store!.name }} · {{ providerName(storeId) }}
          </div>
          <h1>{{ product.name }}</h1>
          <p class="product-unit">
            {{ product.unit }} ·
            <span :class="product.available ? 'available' : 'unavailable'">{{
              product.available ? "В наличии" : "Нет в наличии"
            }}</span>
          </p>
          <p class="product-description">
            {{
              product.description ||
              `Актуальная позиция из каталога ${store!.name}. Состав и характеристики упаковки проверьте перед оформлением в магазине.`
            }}
          </p>
          <p v-if="product.rating" class="product-rating">
            <AppIcon name="Star" :size="15" /> {{ product.rating }}
          </p>
          <div class="product-buy-row">
            <div>
              <strong>{{ money(product.price) }} BYN</strong
              ><del v-if="product.oldPrice"
                >{{ money(product.oldPrice) }} BYN</del
              >
            </div>
            <button class="primary" :disabled="!product.available" @click="add">
              <AppIcon :name="inCart ? 'Check' : 'Plus'" :size="18" />{{
                replaceId
                  ? "Заменить товар"
                  : inCart
                    ? `${inCart} в корзине`
                    : "Добавить в корзину"
              }}
            </button>
          </div>
          <a
            :href="productSourceUrl(product)"
            target="_blank"
            rel="noopener noreferrer"
            class="text-button product-yandex-link"
            >Проверить товар в {{ providerName(storeId) }}
            <AppIcon name="ExternalLink" :size="13"
          /></a>
        </div>
      </section>
      <section class="similar-products">
        <div class="section-head product-section-head">
          <div>
            <span class="eyebrow">СРАВНЕНИЕ ЦЕН</span>
            <h2>Такой же товар в других магазинах</h2>
          </div>
          <span>{{ location.label }}</span>
        </div>
        <p v-if="relatedPending" role="status">
          <span class="spinner" /> Проверяем похожие товары…
        </p>
        <div v-if="exactRelated.length" class="similar-store-groups">
          <div
            v-for="group in exactRelated"
            :key="group.store.id"
            class="similar-store-group"
          >
            <div class="similar-store-title">
              <span
                class="store-logo"
                :style="{ background: group.store.color }"
                >{{ group.store.letter }}</span
              >
              <h3>{{ group.store.name }}</h3>
              <NuxtLink
                :to="{
                  path: `/stores/${group.store.id}`,
                  query: { q: product.name },
                }"
                >В каталог</NuxtLink
              >
            </div>
            <div class="catalog-product-grid compact-grid">
              <CatalogProductCard
                v-for="item in group.products"
                :key="item.id"
                :product="item"
                :replace-id="replaceId"
              />
            </div>
          </div>
        </div>
        <div v-else-if="!relatedPending" class="empty-state compact">
          <h2>Точного совпадения в других магазинах нет</h2>
          <p>Ниже показываем похожие товары, чтобы вы могли выбрать замену.</p>
        </div>
      </section>
      <section v-if="related.length" class="similar-products">
        <div class="section-head product-section-head">
          <div>
            <span class="eyebrow">АЛЬТЕРНАТИВЫ В ДРУГИХ СЕТЯХ</span>
            <h2>Похожие товары в других магазинах</h2>
          </div>
          <span>{{ location.label }}</span>
        </div>
        <div class="similar-store-groups">
          <div
            v-for="group in related"
            :key="group.store.id"
            class="similar-store-group"
          >
            <div class="similar-store-title">
              <span
                class="store-logo"
                :style="{ background: group.store.color }"
                >{{ group.store.letter }}</span
              >
              <h3>{{ group.store.name }}</h3>
              <NuxtLink
                :to="{
                  path: `/stores/${group.store.id}`,
                  query: { q: categoryQuery(product.name) },
                }"
                >В каталог</NuxtLink
              >
            </div>
            <div class="catalog-product-grid compact-grid">
              <CatalogProductCard
                v-for="item in group.products"
                :key="item.id"
                :product="item"
                :replace-id="replaceId"
              />
            </div>
          </div>
        </div>
      </section>
      <section v-if="sameStore.length" class="similar-products">
        <div class="section-head product-section-head">
          <div>
            <span class="eyebrow">ЕЩЁ В {{ store!.name.toUpperCase() }}</span>
            <h2>Похожие товары в этом магазине</h2>
          </div>
        </div>
        <div class="catalog-product-grid compact-grid">
          <CatalogProductCard
            v-for="item in sameStore"
            :key="item.id"
            :product="item"
            :replace-id="replaceId"
          />
        </div>
      </section>
    </template>
  </div>
</template>
