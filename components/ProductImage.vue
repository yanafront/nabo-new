<script setup lang="ts">
import { productImageUrl } from "~/shared/product-image";
const props = withDefaults(
  defineProps<{
    src?: string | null;
    fallback?: string;
    alt?: string;
    eager?: boolean;
  }>(),
  { fallback: "🛍️" },
);
const source = computed(() => productImageUrl(props.src));
const failed = ref(false);
watch(source, () => {
  failed.value = false;
});
</script>
<template>
  <img
    v-if="source && !failed"
    :src="source"
    class="product-image"
    :alt="alt || ''"
    width="320"
    height="320"
    :loading="eager ? 'eager' : 'lazy'"
    :fetchpriority="eager ? 'high' : 'auto'"
    decoding="async"
    @error="failed = true"
  />
  <span v-else class="product-emoji" aria-hidden="true">{{ fallback }}</span>
</template>
