<script setup lang="ts">
import { PRIMARY_SITE_ORIGIN } from "~/shared/seo/core";
import { retailStores, type StoreId } from "~/shared/yandex";
import { productSchema, breadcrumb } from "~/shared/seo/core";
definePageMeta({ key: (route) => route.path });
const route = useRoute();
const storeId = route.params.storeId as StoreId;
if (!retailStores.some((store) => store.id === storeId))
  throw createError({ statusCode: 404, statusMessage: "Товар не найден" });
const { data, error } = await useAsyncData(
  `public-product:${storeId}:${route.params.id}`,
  () =>
    $fetch(
      `/api/public-product/${storeId}/${encodeURIComponent(String(route.params.id))}`,
      {
        query: {
          name: typeof route.query.name === "string" ? route.query.name : "",
        },
      },
    ),
);
if (error.value)
  throw createError({
    statusCode: error.value.statusCode || 503,
    statusMessage:
      error.value.statusCode === 404
        ? "Товар не найден"
        : "Товар временно недоступен",
  });
const origin = PRIMARY_SITE_ORIGIN;
usePageSeo(() => ({
  title: `${data.value?.product.name} — цена в ${retailStores.find((s) => s.id === storeId)?.name} | Nabo`,
  description: `${data.value?.product.name}, ${data.value?.product.unit}. Посмотрите цену, наличие и похожие товары в магазинах Беларуси.`,
  image: data.value?.product.image || undefined,
  schemas: data.value
    ? [
        productSchema(data.value.product, origin),
        breadcrumb(origin, [
          { name: "Главная", path: "/" },
          { name: "Товары", path: "/products" },
          { name: data.value.product.name, path: route.path },
        ]),
      ]
    : [],
}));
</script>
<template>
  <div>
    <SeoBreadcrumbs
      v-if="data"
      :entries="[
        { name: 'Главная', path: '/' },
        { name: 'Продукты', path: '/products' },
        { name: data.product.name, path: route.path },
      ]"
    />
    <ProductDetails
      :snapshot="data?.product"
      :store-id="storeId"
      :product-id="String(route.params.id)"
      :initial-name="
        typeof route.query.name === 'string' ? route.query.name : ''
      "
      :replace-id="
        typeof route.query.replace === 'string'
          ? route.query.replace
          : undefined
      "
    />
    <nav class="seo-links">
      <NuxtLink :to="`/stores/${storeId}`">Другие товары магазина</NuxtLink
      ><NuxtLink to="/recipes">Подобрать рецепт</NuxtLink>
    </nav>
  </div>
</template>
