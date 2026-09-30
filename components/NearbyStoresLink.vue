<script setup lang="ts">
import { retailStores, type StoreId } from "~/shared/yandex";
const props = defineProps<{ storeId: StoreId }>();
const { location } = useRetail();
const name = computed(
  () => retailStores.find((store) => store.id === props.storeId)!.name,
);
const href = computed(() => {
  const center = `${location.value.lon},${location.value.lat}`;
  const query = new URLSearchParams({
    text: `${name.value} супермаркет`,
    ll: center,
    sll: center,
    z: "13",
    sspn: "0.15,0.10",
  });
  return `https://yandex.ru/maps/?${query}`;
});
</script>
<template>
  <a
    :href="href"
    class="nearby-stores-link"
    target="_blank"
    rel="noopener noreferrer"
    :aria-label="`${name}: магазины рядом на Яндекс Картах (новая вкладка)`"
    :title="`Поиск ${name} рядом с точкой «${location.label}» на Яндекс Картах`"
  >
    <AppIcon name="MapPin" :size="15" />Магазины рядом
    <AppIcon name="ExternalLink" :size="12" />
  </a>
</template>
