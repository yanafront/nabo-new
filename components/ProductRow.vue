<script setup lang="ts">
import { providerName } from "~/shared/yandex";
import type { Product } from "~/data/catalog";
defineProps<{
  product: Product;
  quantity: number;
}>();
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
      <h3>{{ product.name }}</h3>
      <p>
        {{ product.unit
        }}<template v-if="product.storeId">
          · {{ providerName(product.storeId) }}</template
        >
      </p>
      <p v-if="product.refreshStatus === 'not_found'" class="error">
        Нет в наличии · в сумму не включён
      </p>
      <p
        v-else-if="product.refreshError === 'PRODUCT_LOOKUP_UNSUPPORTED'"
        class="muted"
      >
        Магазин пока не обновляет цену по ID. Выберите товар заново через
        «Заменить».
      </p>
      <p
        v-else-if="product.refreshStatus === 'error' || product.price === null"
        class="muted"
      >
        Цена не подтверждена · в сумму не включён
      </p>
      <button class="text-button" @click="$emit('replace')">Заменить</button>
    </div>
    <strong class="row-price"
      >{{ product.price !== null ? money(product.price * quantity) : "—"
      }}<small>BYN</small></strong
    >
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
  </article>
</template>
