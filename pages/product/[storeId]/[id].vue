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
const store = retailStores.find((item) => item.id === storeId);
if (!store || !initialName)
  throw createError({ statusCode: 404, statusMessage: "Товар не найден" });

const { location } = useRetail();
const { addProduct, items } = useBasket();
const product = ref<RetailProduct | null>(null);
const related = ref<
  Array<{ store: (typeof retailStores)[number]; products: RetailProduct[] }>
>([]);
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

async function load() {
  controller?.abort();
  controller = new AbortController();
  pending.value = true;
  error.value = "";
  try {
    const query = categoryQuery(initialName);
    const responses = await Promise.all(
      retailStores.map((item) =>
        $fetch<SearchResult>("/api/yandex/search", {
          method: "POST",
          body: {
            query: item.id === storeId ? initialName : query,
            storeId: item.id,
            location: location.value,
          },
          signal: controller!.signal,
          timeout: 25000,
          retry: 0,
        }),
      ),
    );
    const current = responses.find((response) => response.storeId === storeId);
    product.value =
      current?.products.find((item) => item.id === productId) ||
      current?.products[0] ||
      null;
    related.value = responses
      .filter(
        (response) => response.storeId !== storeId && response.status === "ok",
      )
      .map((response) => ({
        store: retailStores.find((item) => item.id === response.storeId)!,
        products: response.products
          .filter((item) => item.available)
          .slice(0, 3),
      }))
      .filter((group) => group.products.length);
    if (!product.value) error.value = "Этот товар больше не найден в каталоге.";
  } catch {
    if (!controller.signal.aborted)
      error.value = "Не удалось загрузить товар. Попробуйте ещё раз.";
  } finally {
    pending.value = false;
  }
}

const inCart = computed(
  () =>
    items.value.find((item) => item.productId === `${storeId}:${productId}`)
      ?.quantity || 0,
);
function add() {
  if (product.value) addProduct(product.value);
}

watch(location, load, { deep: true });
onMounted(load);
onBeforeUnmount(() => controller?.abort());
</script>

<template>
  <div class="inner-page product-page">
    <NuxtLink :to="`/stores/${storeId}`" class="back-link"
      ><AppIcon name="ArrowLeft" :size="16" /> В каталог
      {{ store!.name }}</NuxtLink
    >
    <div v-if="pending" class="catalog-loading panel" role="status">
      <span class="spinner" /> Загружаем товар и сравниваем цены…
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
                inCart ? `${inCart} в корзине` : "Добавить в корзину"
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
            <span class="eyebrow">Сравнение магазинов</span>
            <h2>Похожие товары и цены</h2>
          </div>
          <span>{{ location.label }}</span>
        </div>
        <div v-if="related.length" class="similar-store-groups">
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
              />
            </div>
          </div>
        </div>
        <div v-else class="empty-state compact">
          <h2>Аналоги пока не найдены</h2>
          <p>Попробуйте обновить страницу немного позже.</p>
        </div>
      </section>
    </template>
  </div>
</template>
