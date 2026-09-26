<script setup lang="ts">
import { productSourceUrl, providerName } from "~/shared/yandex";
import type { Product } from "~/data/catalog";
defineProps<{
  product: Product;
  quantity: number;
  required?: boolean;
  allowReplacement?: boolean;
}>();
defineEmits<{
  change: [delta: number];
  remove: [];
  replace: [];
  preference: [key: "required" | "allowReplacement", value: boolean];
}>();
const options = ref(false);
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
      <div class="row-tags">
        <span v-if="required">Обязательно</span
        ><span v-if="allowReplacement === false">Без замен</span>
      </div>
      <button class="text-button" @click="$emit('replace')">Заменить</button
      ><button
        class="text-button subtle"
        :aria-expanded="options"
        @click="options = !options"
      >
        {{ options ? "Скрыть" : "Пожелания" }}
      </button>
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
    <div v-if="options" class="row-options">
      <label class="checkbox"
        ><input
          type="checkbox"
          :checked="required"
          @change="
            $emit(
              'preference',
              'required',
              ($event.target as HTMLInputElement).checked,
            )
          "
        />Обязательный товар</label
      ><label class="checkbox"
        ><input
          type="checkbox"
          :checked="allowReplacement !== false"
          @change="
            $emit(
              'preference',
              'allowReplacement',
              ($event.target as HTMLInputElement).checked,
            )
          "
        />Можно предложить замену</label
      ><small
        >Без замен сравним только это название и упаковку. Обязательные позиции
        выделим, если магазин их не найдёт.</small
      ><a
        v-if="product.storeId && product.sourceId"
        :href="
          productSourceUrl({
            id: product.sourceId,
            storeId: product.storeId,
            externalUrl: product.externalUrl,
          })
        "
        target="_blank"
        rel="noopener noreferrer"
        class="text-button"
        >Цена у {{ providerName(product.storeId) }}
        <AppIcon name="ExternalLink" :size="12" /></a
      ><small v-if="product.fetchedAt"
        >Получена
        {{ new Date(product.fetchedAt).toLocaleString("ru-BY") }}</small
      >
    </div>
  </article>
</template>
