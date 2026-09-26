<script setup lang="ts">
import { productSourceUrl, providerName } from "~/shared/yandex";
import type { Product } from "~/data/catalog";
defineProps<{ product: Product; quantity: number }>();
defineEmits<{ change: [delta: number]; remove: []; replace: [] }>();
</script>
<template>
  <article class="product-row">
    <ProductImage :src="product.image" :fallback="product.emoji" />
    <div class="product-name">
      <h3>{{ product.name }}</h3>
      <p>{{ product.unit }}</p>
      <a
        v-if="product.storeId && product.sourceId"
        :href="productSourceUrl({ id: product.sourceId, storeId: product.storeId, externalUrl: product.externalUrl })"
        target="_blank"
        rel="noopener noreferrer"
        class="text-button product-source-link"
        >В {{ providerName(product.storeId) }} <AppIcon name="ExternalLink" :size="12"
      /></a>
      <button class="text-button" @click="$emit('replace')">
        <AppIcon name="RefreshCw" :size="12" /> Заменить
      </button>
    </div>
    <div class="quantity">
      <button
        :aria-label="`Уменьшить количество: ${product.name}`"
        @click="$emit('change', -1)"
      >
        <AppIcon name="Minus" :size="15" /></button
      ><span>{{ quantity }}</span
      ><button
        :disabled="quantity >= 99"
        :aria-label="`Увеличить количество: ${product.name}`"
        @click="$emit('change', 1)"
      >
        <AppIcon name="Plus" :size="15" />
      </button>
    </div>
    <strong class="row-price"
      ><template v-if="product.price !== null"
        >{{ money(product.price * quantity)
        }}<small>BYN · при выборе</small></template
      ><template v-else>—<small>Цена не получена</small></template></strong
    ><button
      class="icon-button delete"
      :aria-label="`Удалить: ${product.name}`"
      @click="$emit('remove')"
    >
      <AppIcon name="X" :size="17" />
    </button>
  </article>
</template>
