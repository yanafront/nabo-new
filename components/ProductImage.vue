<script setup lang="ts">
import { productImageUrl } from "~/shared/product-image";
const props = withDefaults(
  defineProps<{ src?: string | null; fallback?: string }>(),
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
    alt=""
    loading="lazy"
    decoding="async"
    @error="failed = true"
  />
  <span v-else class="product-emoji" aria-hidden="true">{{ fallback }}</span>
</template>
