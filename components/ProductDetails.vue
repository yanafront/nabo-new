<script setup lang="ts">
import {
  productSourceUrl,
  providerName,
  retailStores,
  type RetailProduct,
  type SearchResult,
  type StoreId,
} from "~/shared/yandex";

const props = defineProps<{
  storeId: StoreId;
  productId: string;
  initialName?: string;
  replaceId?: string;
  modal?: boolean;
  snapshot?: RetailProduct;
}>();
const emit = defineEmits<{ done: [] }>();
const { storeId, productId, initialName = "", replaceId } = props;
const store = retailStores.find((item) => item.id === storeId);
if (!store)
  throw createError({ statusCode: 404, statusMessage: "Товар не найден" });

const { location } = useRetail();
const { searchProducts, cachedProduct, getProduct } = useApi();
const relatedPending = ref(false);
const { addProduct, items, notice } = useBasket();
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
  product.value =
    cachedProduct(storeId, productId, location.value) || props.snapshot || null;
  pending.value = !product.value;
  exactRelated.value = [];
  related.value = [];
  sameStore.value = [];
  relatedPending.value = true;
  error.value = "";
  const point = { ...location.value };
  const valid = () => controller === current && !current.signal.aborted;
  const primary = async () => {
    try {
      const result = await getProduct(
        { storeId, id: productId, location: point },
        current.signal,
      );
      if (!valid()) return;
      if (result.status === "ok" && result.product)
        product.value = result.product;
      else if (result.error === "PRODUCT_LOOKUP_UNSUPPORTED" && initialName) {
        const response = await searchProducts(
          { storeId, query: initialName.slice(0, 160), location: point },
          current.signal,
        );
        if (!valid()) return;
        product.value =
          response.products.find((item) => item.id === productId) || null;
        if (!product.value)
          error.value = "Этот товар больше не найден в каталоге.";
      } else {
        product.value = null;
        error.value =
          result.status === "not_found"
            ? "Этот товар больше не найден в каталоге."
            : result.error === "PRODUCT_LOOKUP_UNSUPPORTED"
              ? "Магазин пока не поддерживает загрузку по ID. Найдите товар через поиск."
              : "Не удалось обновить товар. Повторите попытку.";
      }
    } catch {
      if (valid()) {
        product.value = null;
        error.value = "Не удалось загрузить товар. Попробуйте ещё раз.";
      }
    } finally {
      if (valid()) pending.value = false;
    }
  };
  // Start the requested product first. Each secondary store can fail independently.
  await primary();
  if (!valid() || !product.value) {
    if (valid()) relatedPending.value = false;
    return;
  }
  const selectedName = product.value.name;
  const query = categoryQuery(selectedName);
  const others = retailStores
    .filter((item) => item.id !== storeId)
    .map(async (store) => {
      try {
        const response = await searchProducts(
          {
            storeId: store.id,
            query: selectedName.slice(0, 160),
            location: point,
          },
          current.signal,
        );
        if (!valid() || response.status !== "ok") return;
        const available = response.products.filter((item) => item.available);
        const exact = available
          .filter(
            (item) =>
              comparableName(item.name) === comparableName(selectedName),
          )
          .slice(0, 3);
        const similar = available
          .filter(
            (item) =>
              comparableName(item.name) !== comparableName(selectedName),
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
  await Promise.all([...others, localAlternatives]);
  if (valid()) relatedPending.value = false;
}

const inCart = computed(
  () =>
    items.value.find((item) => item.productId === `${storeId}:${productId}`)
      ?.quantity || 0,
);
const adding = ref(false);
const addMessage = ref("");
const addFailed = ref(false);
async function add() {
  if (adding.value || !product.value) return;
  adding.value = true;
  addMessage.value = "";
  try {
    const success = await addProduct(product.value, replaceId);
    addFailed.value = !success;
    addMessage.value = success
      ? "Товар добавлен в корзину"
      : notice.value || "Не удалось добавить товар. Попробуйте ещё раз.";
    if (success && replaceId) {
      if (props.modal) emit("done");
      else await navigateTo("/basket");
    }
  } finally {
    adding.value = false;
  }
}

watch(location, load, { deep: true });
onMounted(load);
onBeforeUnmount(() => controller?.abort());
</script>

<template>
  <div
    :class="['product-page', modal ? 'product-preview-detail' : 'inner-page']"
  >
    <div class="product-content">
      <p
        v-if="addMessage"
        :class="addFailed ? 'error' : 'preview-success'"
        role="status"
      >
        {{ addMessage }}
      </p>
      <NuxtLink
        v-if="!modal"
        :to="{
          path: '/products',
          query: {
            q: categoryQuery(product?.name || initialName),
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
              <StoreBrand :store-id="storeId" />
            </div>
            <h1>{{ product.name }}</h1>
            <p
              v-if="product.categories?.some((category) => category.name)"
              class="muted"
            >
              {{
                product.categories
                  .filter((category) => category.name)
                  .map((category) => category.name)
                  .join(" · ")
              }}
            </p>
            <p class="product-unit">
              {{ product.unit }} ·
              <span :class="product.available ? 'available' : 'unavailable'">{{
                product.available ? "В наличии" : "Нет в наличии"
              }}</span>
            </p>
            <details
              v-if="product.description"
              class="product-description-disclosure"
            >
              <summary>Описание и характеристики</summary>
              <p class="product-description">{{ product.description }}</p>
            </details>
            <p v-if="product.rating" class="product-rating">
              <AppIcon name="Star" :size="15" /> {{ product.rating }}
            </p>
            <div class="product-actions">
              <FavoriteButton
                :store-id="product.storeId"
                :id="product.id"
                :name="product.name"
              />
              <div v-if="!modal" class="product-buy-row">
                <div>
                  <strong>{{ money(product.price) }} BYN</strong
                  ><del v-if="product.oldPrice"
                    >{{ money(product.oldPrice) }} BYN</del
                  >
                </div>
                <button
                  class="primary"
                  :disabled="!product.available || adding"
                  @click="add"
                >
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
                <h3><StoreBrand :store-id="group.store.id" /></h3>
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
            <p>
              Ниже показываем похожие товары, чтобы вы могли выбрать замену.
            </p>
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
                <h3><StoreBrand :store-id="group.store.id" /></h3>
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
    <div v-if="modal && product" class="product-preview-buy">
      <div class="preview-price">
        <strong>{{ money(product.price) }} <small>BYN</small></strong
        ><span
          >{{ product.unit
          }}<template v-if="inCart"> · {{ inCart }} в корзине</template></span
        >
      </div>
      <button
        class="primary"
        :disabled="!product.available || adding"
        @click="add"
      >
        <span v-if="adding" class="spinner" aria-hidden="true" /><AppIcon
          v-else
          :name="replaceId ? 'RefreshCw' : 'Plus'"
          :size="18"
        />
        {{
          adding
            ? "Добавляем…"
            : !product.available
              ? "Нет в наличии"
              : replaceId
                ? "Заменить товар"
                : inCart
                  ? "Добавить ещё"
                  : "В корзину"
        }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.product-description-disclosure {
  margin: 12px 0;
  font-size: 14px;
}
.product-description-disclosure summary {
  cursor: pointer;
  color: var(--muted);
}
.product-preview-detail {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.product-preview-detail .product-content {
  overflow-y: auto;
  overscroll-behavior: contain;
  min-height: 0;
  padding: 20px 24px;
}
.product-preview-detail .product-detail {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  padding: 0;
  gap: 24px;
  border: 0;
  box-shadow: none;
}
.product-preview-detail .product-detail-image {
  align-self: start;
}
.product-preview-detail
  :deep(.product-detail-image :is(.product-image, .product-emoji)) {
  height: 180px;
  width: 100%;
  margin: 0;
}
.product-preview-detail h1 {
  font-size: 22px;
  line-height: 1.3;
  margin: 12px 0;
  overflow-wrap: anywhere;
}
.product-preview-detail .product-unit {
  font-size: 13px;
  margin: 8px 0;
}
.product-preview-detail .product-yandex-link {
  font-size: 12px;
  margin-top: 12px;
}
.product-preview-detail .similar-products {
  margin-top: 24px;
}
.product-preview-detail .eyebrow {
  display: none;
}
.product-preview-detail .section-head {
  margin-bottom: 12px;
}
.product-preview-detail .section-head h2 {
  font-size: 17px;
}
.product-preview-detail .product-section-head > span {
  display: none;
}
.product-preview-detail .empty-state {
  padding: 14px;
  text-align: left;
}
.product-preview-detail .empty-state h2 {
  font-size: 14px;
}
.product-preview-detail .empty-state p {
  margin-bottom: 0;
}
.product-preview-detail :deep(.catalog-product-grid) {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.product-preview-detail
  :deep(.catalog-product-link :is(.product-image, .product-emoji)) {
  height: 100px;
}
.product-preview-detail :deep(.catalog-product-copy h3) {
  font-size: 13px;
}
.product-preview-detail .similar-store-title {
  margin-bottom: 8px;
}
.product-preview-buy {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;
  padding: 14px 24px;
  border-top: 1px solid var(--line);
  background: #fff;
}
.preview-price {
  min-width: 0;
  display: grid;
  gap: 2px;
}
.preview-price strong {
  font-size: 24px;
  white-space: nowrap;
}
.preview-price small {
  font-size: 13px;
}
.preview-price span {
  color: var(--muted);
  font-size: 12px;
}
.product-preview-buy .primary {
  min-height: 44px;
  padding: 10px 18px;
  font-size: 14px;
  flex-shrink: 0;
}
.product-preview-buy .spinner {
  width: 16px;
  height: 16px;
  margin: 0;
}
@media (max-width: 600px) {
  .product-preview-detail .product-content {
    padding: 16px;
  }
  .product-preview-detail .product-detail {
    grid-template-columns: 96px minmax(0, 1fr);
    gap: 14px;
  }
  .product-preview-detail
    :deep(.product-detail-image :is(.product-image, .product-emoji)) {
    height: 110px;
  }
  .product-preview-detail h1 {
    font-size: 17px;
    margin: 8px 0;
  }
  .product-preview-detail .product-store-line {
    margin: 0;
  }
  .product-preview-buy {
    padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
    gap: 10px;
  }
  .preview-price strong {
    font-size: 20px;
  }
  .product-preview-buy .primary {
    padding: 10px 12px;
    font-size: 13px;
  }
}
</style>

<style scoped>
.preview-success {
  margin: 0 0 12px;
  padding: 8px 12px;
  border-radius: 10px;
  background: var(--brand-soft);
  color: #496c24;
}
</style>

<style scoped>
.product-preview-detail .product-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}
.product-preview-detail .product-yandex-link {
  margin: 0;
}
</style>
