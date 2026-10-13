<script setup lang="ts">
import { jsonLd, productPath } from "~/shared/seo/core";
import { providerName, type StoreId } from "~/shared/yandex";
import type { SeoProductReference } from "~/server/utils/seo-service";
const props = defineProps<{ storeId?: StoreId }>();
const route = useRoute();
const page = computed(() => Math.max(1, Number(route.query.page) || 1));
const { data } = await useAsyncData(
  `known-products:${props.storeId || "all"}`,
  () =>
    $fetch<{ items: SeoProductReference[]; total: number }>(
      "/api/seo-products",
      { query: { page: page.value, storeId: props.storeId } },
    ),
  { watch: [page] },
);
if (page.value > 1 && data.value && (page.value - 1) * 24 >= data.value.total)
  throw createError({ statusCode: 404, statusMessage: "Страница не найдена" });
const origin = useRuntimeConfig().public.siteUrl;
useHead(() => ({
  script: data.value?.items.length
    ? [
        {
          key: "known-products-schema",
          type: "application/ld+json",
          innerHTML: jsonLd({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: props.storeId
              ? `Товары ${providerName(props.storeId)}`
              : "Товары магазинов",
            itemListElement: data.value.items.map((p, i) => ({
              "@type": "ListItem",
              position: (page.value - 1) * 24 + i + 1,
              url: origin + productPath(p.storeId, p.id),
            })),
          }),
        },
      ]
    : [],
}));
function link(n: number) {
  return {
    path: route.path,
    query: { ...route.query, page: n > 1 ? String(n) : undefined },
  };
}
</script>
<template>
  <section v-if="data?.items.length" class="known-products">
    <h2>Товары {{ storeId ? providerName(storeId) : "магазинов" }}</h2>
    <div class="catalog-product-grid compact-grid">
      <NuxtLink
        v-for="product in data.items"
        :key="product.storeId + product.id"
        :to="productPath(product.storeId, product.id)"
        class="catalog-product-card known-product-link"
      >
        <ProductImage :src="product.image" :alt="product.name" />
        <h3>{{ product.name }}</h3>
        <p class="muted">
          {{ product.unit }} · {{ providerName(product.storeId as StoreId) }}
        </p>
      </NuxtLink>
    </div>
    <nav
      v-if="data.total > 24"
      class="known-pagination"
      aria-label="Страницы товаров"
    >
      <NuxtLink v-if="page > 1" :to="link(page - 1)">Назад</NuxtLink
      ><span>Страница {{ page }}</span
      ><NuxtLink v-if="page * 24 < data.total" :to="link(page + 1)"
        >Дальше</NuxtLink
      >
    </nav>
  </section>
</template>
<style scoped>
.known-products {
  margin-top: 28px;
}
.known-products h2 {
  font-size: 20px;
  margin-bottom: 16px;
}
.known-product-link {
  display: block;
  padding: 16px;
}
.known-product-link h3 {
  font-size: 14px;
  line-height: 1.4;
  margin: 12px 0 6px;
}
.known-product-link p {
  font-size: 12px;
}
.known-pagination {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin: 24px 0;
}
</style>
