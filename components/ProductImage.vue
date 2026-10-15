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
const image = ref<HTMLImageElement>();
function onError(event: Event) {
  if (event.currentTarget === image.value) failed.value = true;
}
watch(source, () => {
  failed.value = false;
});
</script>
<template>
  <img
    v-if="source && !failed"
    :key="source"
    ref="image"
    :src="source"
    class="product-image"
    :alt="alt || ''"
    width="320"
    height="320"
    :loading="eager ? 'eager' : 'lazy'"
    :fetchpriority="eager ? 'high' : 'auto'"
    decoding="async"
    @error="onError"
  />
  <span v-else class="product-emoji" aria-hidden="true">{{ fallback }}</span>
</template>
