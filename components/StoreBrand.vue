<script setup lang="ts">
import { retailStores, type StoreId } from "~/shared/yandex";
const props = withDefaults(
  defineProps<{
    storeId: StoreId;
    size?: "inline" | "compact" | "regular" | "large" | "home";
  }>(),
  { size: "regular" },
);
const store = computed(() =>
  retailStores.find((entry) => entry.id === props.storeId)!,
);
const extensions: Record<StoreId, string> = {
  evroopt: "svg",
  green: "svg",
  gippo: "webp",
  sosedi: "webp",
  belmarket: "svg",
  santa: "webp",
};
const dimensions: Record<StoreId, [number, number]> = {
  evroopt: [280, 72],
  green: [360, 120],
  gippo: [260, 60],
  sosedi: [142, 41],
  belmarket: [4200, 1067],
  santa: [260, 123],
};
const failed = ref(false);
</script>
<template>
  <span
    class="store-brand"
    :class="[`store-brand--${size}`, `store-brand--${storeId}`]"
  >
    <img
      v-if="!failed"
      :src="`/brand/stores/${storeId}.${extensions[storeId]}`"
      :alt="store.name"
      :width="dimensions[storeId][0]"
      :height="dimensions[storeId][1]"
      decoding="async"
      @error="failed = true"
    />
    <span v-else>{{ store.name }}</span>
  </span>
</template>
