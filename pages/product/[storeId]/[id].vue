<script setup lang="ts">
import { retailStores, type StoreId } from "~/shared/yandex";
const route = useRoute();
const storeId = route.params.storeId as StoreId;
if (!retailStores.some((store) => store.id === storeId))
  throw createError({ statusCode: 404, statusMessage: "Товар не найден" });
</script>
<template>
  <ProductDetails
    :store-id="storeId"
    :product-id="String(route.params.id)"
    :initial-name="typeof route.query.name === 'string' ? route.query.name : ''"
    :replace-id="
      typeof route.query.replace === 'string' ? route.query.replace : undefined
    "
  />
</template>
