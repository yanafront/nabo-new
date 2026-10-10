<script setup lang="ts">
import type { RetailProduct } from "~/shared/yandex";

const props = defineProps<{ product: RetailProduct; replaceId?: string }>();
const { addProduct, items } = useBasket();
const added = ref(false);
const { open } = useProductPreview();
const productUrl = computed(() => {
  const query = new URLSearchParams({ name: props.product.name });
  if (props.replaceId) query.set("replace", props.replaceId);
  return `/product/${props.product.storeId}/${encodeURIComponent(props.product.id)}?${query}`;
});
function preview(event: MouseEvent) {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  event.preventDefault();
  open({
    storeId: props.product.storeId,
    id: props.product.id,
    name: props.product.name,
    replaceId: props.replaceId,
    product: props.product,
  });
}
const inCart = computed(
  () =>
    items.value.find(
      (item) =>
        item.productId === `${props.product.storeId}:${props.product.id}`,
    )?.quantity || 0,
);

async function add() {
  added.value = await addProduct(props.product, props.replaceId);
  if (added.value && props.replaceId) navigateTo("/basket");
}
</script>

<template>
  <article class="catalog-product-card">
    <FavoriteButton
      class="catalog-favorite"
      :store-id="product.storeId"
      :id="product.id"
      :name="product.name"
    />
    <a :href="productUrl" class="catalog-product-link" @click="preview">
      <ProductImage :src="product.image" />
      <div class="catalog-product-copy">
        <h3>{{ product.name }}</h3>
        <p>
          {{ product.unit }} ·
          {{ product.available ? "В наличии" : "Нет в наличии" }}
        </p>
        <strong>{{ money(product.price) }} BYN</strong>
        <del v-if="product.oldPrice">{{ money(product.oldPrice) }} BYN</del>
      </div>
    </a>
    <button
      class="catalog-add"
      :class="{ added: added || inCart }"
      :disabled="!product.available"
      :aria-label="`${replaceId ? 'Заменить на' : 'Добавить в корзину'}: ${product.name}`"
      @click="add"
    >
      <AppIcon :name="added || inCart ? 'Check' : 'Plus'" :size="18" />
      <span>{{
        replaceId
          ? "Заменить"
          : inCart
            ? `${inCart} в корзине`
            : product.available
              ? "Добавить"
              : "Недоступно"
      }}</span>
    </button>
  </article>
</template>

<style scoped>
.catalog-product-card {
  position: relative;
}
.catalog-favorite {
  position: absolute;
  z-index: 1;
  top: 10px;
  right: 10px;
}
</style>
