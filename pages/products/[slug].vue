<script setup lang="ts">
import { productTopic } from "~/shared/seo/topics";
import { productPath, PRIMARY_SITE_ORIGIN } from "~/shared/seo/core";
import { retailStores, type ProductResult } from "~/shared/yandex";
import type { Recipe } from "~/shared/recipe/model";
import type { SeoProductReference } from "~/shared/seo/products";
const route = useRoute();
const topic = productTopic(route.params.slug);
if (!topic)
  throw createError({ statusCode: 404, statusMessage: "Продукт не найден" });
const priceFor = (storeId: string, id: string) =>
  data.value?.prices?.find(
    (result) => result.storeId === storeId && result.id === id,
  )?.product;
const page = computed(() => Math.max(1, Number(route.query.page) || 1));
const { data, error } = await useAsyncData(
  computed(() => `product-topic:${topic.slug}:${page.value}`),
  () =>
    $fetch<{
      products: { items: SeoProductReference[]; total: number };
      recipes: Recipe[];
      prices: ProductResult[];
    }>(`/api/product-topics/${topic.slug}`, { query: { page: page.value } }),
);
if (error.value)
  throw createError({
    statusCode: 503,
    statusMessage: "Каталог временно недоступен",
  });
if (page.value > 1 && !data.value?.products.items.length)
  throw createError({ statusCode: 404 });
usePageSeo(() => ({
  title: `${topic.name}: варианты в магазинах Беларуси${page.value > 1 ? ` — страница ${page.value}` : ""} | Nabo`,
  description: `${topic.name}: варианты продуктов в магазинах Беларуси и рецепты с этим ингредиентом. Откройте товар для проверки актуальной цены и наличия по вашему адресу.`,
  noindex: !data.value?.products.items.length,
  schemas: [
    {
      "@type": "ItemList",
      name: topic.name,
      itemListElement:
        data.value?.products.items.map((product, index) => ({
          "@type": "ListItem",
          position: (page.value - 1) * 24 + index + 1,
          url: PRIMARY_SITE_ORIGIN + productPath(product.storeId, product.id),
          name: product.name,
        })) || [],
    },
  ],
}));
</script>
<template>
  <div class="inner-page">
    <SeoBreadcrumbs
      :entries="[
        { name: 'Главная', path: '/' },
        { name: 'Продукты', path: '/products' },
        { name: topic.name, path: `/products/${topic.slug}` },
      ]"
    />
    <h1>{{ topic.name }}</h1>
    <p class="muted seo-intro">
      Варианты в магазинах и блюда с этим ингредиентом. Актуальная цена и
      наличие проверяются в карточке товара по адресу доставки; названия и
      фасовки могут различаться.
    </p>
    <NuxtLink
      class="primary"
      :to="{ path: '/products', query: { q: topic.query } }"
      >Проверить цены в магазинах<AppIcon name="ArrowRight" :size="16"
    /></NuxtLink>
    <section class="seo-section" v-if="data?.products.items.length">
      <h2>Варианты товара</h2>
      <p v-if="data.prices?.length" class="muted">
        Цены и наличие: Минск, центр. Доставка не включена. Точный адрес и
        актуальные условия проверьте в карточке.
      </p>
      <div class="catalog-product-grid">
        <NuxtLink
          class="catalog-product-card known-product-link"
          v-for="product in data.products.items"
          :key="product.storeId + product.id"
          :to="productPath(product.storeId, product.id)"
          ><ProductImage :src="product.image" :alt="product.name" />
          <h3>{{ product.name }}</h3>
          <p v-if="priceFor(product.storeId, product.id)">
            <strong
              >{{
                money(priceFor(product.storeId, product.id)!.price)
              }}
              BYN</strong
            >
            ·
            {{
              priceFor(product.storeId, product.id)!.available
                ? "В наличии"
                : "Нет в наличии"
            }}
          </p>
          <p class="muted">
            {{ product.unit }} ·
            {{ retailStores.find((s) => s.id === product.storeId)?.name }}
          </p></NuxtLink
        >
      </div>
      <nav
        class="seo-pagination"
        v-if="data.products.total > 24"
        aria-label="Страницы товаров"
      >
        <NuxtLink
          v-if="page > 1"
          :to="{ path: route.path, query: page > 2 ? { page: page - 1 } : {} }"
          >Назад</NuxtLink
        ><span>Страница {{ page }}</span
        ><NuxtLink
          v-if="page * 24 < data.products.total"
          :to="{ path: route.path, query: { page: page + 1 } }"
          >Дальше</NuxtLink
        >
      </nav>
    </section>
    <p v-else class="seo-intro">
      Варианты пока не добавлены в каталог. Используйте поиск для проверки
      магазинов.
    </p>
    <section class="seo-section" v-if="data?.recipes.length">
      <h2>Что приготовить</h2>
      <div class="dish-grid">
        <RecipeCard
          v-for="recipe in data.recipes"
          :recipe="recipe"
          :key="recipe.slug"
        />
      </div>
    </section>
    <nav class="seo-links" aria-label="Магазины">
      <NuxtLink
        v-for="store in retailStores"
        :key="store.id"
        :to="`/stores/${store.id}`"
        >{{ store.name }}</NuxtLink
      >
    </nav>
  </div>
</template>
<style scoped>
.known-product-link {
  padding: 14px;
}
.known-product-link h3 {
  font-size: 14px;
  margin: 12px 0 6px;
  line-height: 1.4;
}
.known-product-link p {
  font-size: 12px;
}
.known-product-link :deep(.product-image) {
  height: 140px;
  width: 100%;
  object-fit: contain;
}
</style>
