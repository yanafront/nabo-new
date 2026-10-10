<script setup lang="ts">
import type { RetailProduct } from "~/shared/yandex";
import type { Product } from "~/data/catalog";
const props = defineProps<{
  product: Product;
  quantity: number;
  previewProduct?: RetailProduct;
}>();
const { open: preview } = useProductPreview();
defineEmits<{
  change: [delta: number];
  remove: [];
  replace: [];
}>();
</script>
<template>
  <article class="product-row">
    <ProductImage :src="product.image" :fallback="product.emoji" />
    <div class="product-name">
      <h3>
        <button
          v-if="product.storeId && product.sourceId"
          class="row-preview-link"
          @click="
            preview({
              storeId: product.storeId,
              id: product.sourceId,
              name: product.name,
              product: previewProduct,
            })
          "
        >
          {{ product.name }}</button
        ><template v-else>{{ product.name }}</template>
      </h3>
      <p>
        {{ product.unit
        }}<template v-if="product.storeId">
          · <StoreBrand :store-id="product.storeId" size="inline"
        /></template>
      </p>
      <p v-if="product.refreshStatus === 'not_found'" class="error">
        Нет в наличии
      </p>
      <p v-else-if="product.price === null" class="muted">
        Цена не подтверждена
      </p>
    </div>
    <div class="row-edit">
      <button
        class="text-button row-replace"
        :aria-label="`Заменить: ${product.name}`"
        @click="$emit('replace')"
      >
        Заменить
      </button>
      <div class="row-price">
        <strong
          >{{ product.price !== null ? money(product.price * quantity) : "—"
          }}<small>BYN</small></strong
        >
        <span
          v-if="product.price !== null && quantity > 1"
          class="row-unit-price"
        >
          {{ money(product.price) }} BYN за 1 уп.
        </span>
      </div>
      <div class="quantity">
        <button
          :aria-label="`Уменьшить количество: ${product.name}`"
          @click="$emit('change', -1)"
        >
          <AppIcon name="Minus" :size="16" /></button
        ><span>{{ quantity }}</span
        ><button
          :disabled="quantity >= 99"
          :aria-label="`Увеличить количество: ${product.name}`"
          @click="$emit('change', 1)"
        >
          <AppIcon name="Plus" :size="16" />
        </button>
      </div>
      <button
        class="icon-button delete"
        :aria-label="`Удалить: ${product.name}`"
        @click="$emit('remove')"
      >
        <AppIcon name="X" :size="17" />
      </button>
    </div>
  </article>
</template>

<style scoped>
.row-preview-link {
  padding: 0;
  text-align: left;
  font: inherit;
}
.row-preview-link:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
