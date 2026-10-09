<script setup lang="ts">
import { retailStores, type StoreId } from "~/shared/yandex";
const props = withDefaults(
  defineProps<{
    storeId: StoreId;
    size?: "inline" | "compact" | "regular" | "large";
  }>(),
  { size: "regular" },
);
const store = computed(() =>
  retailStores.find((entry) => entry.id === props.storeId)!,
);
const extensions: Record<StoreId, string> = {
  evroopt: "svg",
  green: "svg",
  gippo: "png",
  sosedi: "png",
  belmarket: "svg",
  santa: "png",
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
      decoding="async"
      @error="failed = true"
    />
    <span v-else>{{ store.name }}</span>
  </span>
</template>
<style scoped>
.store-brand {
  display: inline-flex;
  width: 100px;
  height: 30px;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  vertical-align: middle;
}
.store-brand img {
  display: block;
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
}
.store-brand--inline {
  width: 58px;
  height: 15px;
}
.store-brand--compact {
  width: 82px;
  height: 22px;
}
.store-brand--large {
  width: 130px;
  height: 40px;
}
.store-brand--green img {
  max-width: 88%;
}
.store-brand--santa img {
  max-width: 90%;
}
.store-brand--belmarket {
  padding: 3px 5px;
  border-radius: 4px;
  background: #27ae60;
}
.store-brand--belmarket img {
  max-width: 100%;
}
</style>
