<script setup lang="ts">
import {
  productSourceUrl,
  providerName,
  retailStores,
  type StoreId,
  type SearchResult,
  type RetailProduct,
} from "~/shared/yandex";
const props = defineProps<{ replaceId?: string; category?: string }>();
const emit = defineEmits<{ close: [] }>();
const { items, addProduct, notice, rows } = useBasket();
const { location } = useRetail();
const defaults: Record<string, string> = {
  vegetables: "помидоры",
  dairy: "молоко",
  bakery: "хлеб",
};
const query = ref(
  rows.value.find((r) => r.productId === props.replaceId)?.product.name ||
    defaults[props.category || ""] ||
    "",
);
const storeId = ref<StoreId>("sosedi");
const result = ref<SearchResult | null>(null);
const pending = ref(false);
const error = ref("");
let timer: ReturnType<typeof setTimeout>;
let controller: AbortController | undefined;
async function search() {
  controller?.abort();
  result.value = null;
  error.value = "";
  if (query.value.trim().length < 2) {
    pending.value = false;
    return;
  }
  const current = new AbortController();
  controller = current;
  pending.value = true;
  try {
    const response = await $fetch<SearchResult>("/api/yandex/search", {
      method: "POST",
      body: {
        query: query.value,
        storeId: storeId.value,
        location: location.value,
      },
      signal: current.signal,
      retry: 0,
      timeout: 70000,
    });
    if (controller !== current || current.signal.aborted) return;
    result.value = response;
    if (result.value.status === "error")
      error.value = result.value.error || "Поиск недоступен";
  } catch {
    if (!current.signal.aborted)
      error.value = "Не удалось получить товары. Повторите поиск.";
  } finally {
    if (controller === current) pending.value = false;
  }
}
watch(
  [query, storeId, location],
  () => {
    controller?.abort();
    result.value = null;
    clearTimeout(timer);
    timer = setTimeout(search, 450);
  },
  { deep: true },
);
onMounted(search);
onBeforeUnmount(() => {
  clearTimeout(timer);
  controller?.abort();
});
const feedback = ref("");
const feedbackError = ref(false);
function quantityInCart(p: RetailProduct) {
  return (
    items.value.find((i) => i.productId === `${p.storeId}:${p.id}`)?.quantity ||
    0
  );
}
function select(product: RetailProduct) {
  const success = addProduct(product, props.replaceId);
  feedbackError.value = !success;
  feedback.value = success
    ? `${product.name} — ${props.replaceId ? "заменён" : `в корзине ${quantityInCart(product)} шт.`}`
    : notice.value;
  if (success && props.replaceId) emit("close");
}
async function openBasket() {
  emit("close");
  await navigateTo("/basket");
}
</script>
<template>
  <AppModal
    :title="replaceId ? 'Заменить продукт' : 'Добавить продукт'"
    @close="emit('close')"
    ><div class="retail-tabs">
      <button
        v-for="store in retailStores"
        :key="store.id"
        :class="{ active: storeId === store.id }"
        @click="storeId = store.id"
      >
        {{ store.name }}
      </button>
    </div>
    <form class="search-field" @submit.prevent="search">
      <AppIcon name="Search" /><input
        v-model="query"
        placeholder="Продукт или бренд"
        aria-label="Поиск продукта"
        maxlength="160"
        autofocus
      /><button type="submit" aria-label="Найти продукт">
        <AppIcon name="ArrowRight" />
      </button>
    </form>
    <p class="muted">{{ providerName(storeId) }} · {{ location.label }} · BYN</p>
    <p v-if="pending" role="status" class="generation">
      <span class="spinner" /> Ищем в магазине…
    </p>
    <div v-else-if="error">
      <p role="alert" class="error">{{ error }}</p>
      <button class="secondary" @click="search">Повторить</button>
    </div>
    <div v-else class="picker-list">
      <div v-for="p in result?.products" :key="p.id" class="picker-result">
        <button
          class="picker-product"
          :disabled="!p.available"
          @click="select(p)"
        >
          <ProductImage :src="p.image" /><span
            ><strong>{{ p.name }}</strong
            ><small
              >{{ p.unit }} ·
              {{ p.available ? "В наличии" : "Недоступно" }}</small
            ></span
          ><b
            >{{ money(p.price) }} BYN<del v-if="p.oldPrice">{{
              money(p.oldPrice)
            }}</del></b
          ><span v-if="quantityInCart(p)" class="in-cart-badge"
            ><AppIcon name="Check" :size="14" />{{ quantityInCart(p) }}</span
          ><AppIcon v-else name="Plus" :size="18" />
        </button>
        <a
          :href="productSourceUrl(p)"
          target="_blank"
          rel="noopener noreferrer"
          class="text-button product-source-link"
          :aria-label="`Проверить в ${providerName(p.storeId)}: ${p.name}`"
          >Проверить в {{ providerName(p.storeId) }} <AppIcon name="ExternalLink" :size="12"
        /></a>
      </div>
      <p
        v-if="result?.status === 'ok' && !result.products.length"
        class="empty-search"
      >
        В этой витрине ничего не найдено. Измените запрос или магазин.
      </p>
      <p v-if="!result" class="muted">
        Введите название продукта — покажем товары выбранного магазина.
      </p>
    </div>
    <div class="picker-cart-footer">
      <p
        v-if="feedback"
        :role="feedbackError ? 'alert' : 'status'"
        :class="feedbackError ? 'error' : 'added-feedback'"
      >
        {{ feedback }}
      </p>
      <button
        class="primary full"
        :disabled="!items.length"
        @click="openBasket"
      >
        Перейти в корзину ·
        {{ items.reduce((sum, i) => sum + i.quantity, 0) }} шт.<AppIcon
          name="ArrowRight"
          :size="16"
        />
      </button></div
  ></AppModal>
</template>
