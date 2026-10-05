<script setup lang="ts">
import type { RetailProduct } from "~/shared/yandex";

const props = defineProps<{ product: RetailProduct; replaceId?: string }>();
const { addProduct, items } = useBasket();
const added = ref(false);
const inCart = computed(
  () =>
    items.value.find(
      (item) =>
        item.productId === `${props.product.storeId}:${props.product.id}`,
    )?.quantity || 0,
);

function add() {
  added.value = addProduct(props.product, props.replaceId);
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
    <NuxtLink
      :to="{
        path: `/product/${product.storeId}/${product.id}`,
        query: {
          name: product.name,
          ...(replaceId ? { replace: replaceId } : {}),
        },
      }"
      class="catalog-product-link"
    >
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
    </NuxtLink>
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
