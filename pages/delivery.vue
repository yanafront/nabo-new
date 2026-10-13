<script setup lang="ts">
import type { Recipe } from "~/shared/recipe/model";
const route = useRoute();
const origin = useRuntimeConfig().public.siteUrl;
const page = computed(() => Math.max(1, Number(route.query.page) || 1));
const { data } = await useAsyncData(
  "delivery-recipes",
  () =>
    $fetch<{ recipes: Recipe[]; total: number }>("/api/recipes", {
      query: { offset: (page.value - 1) * 24, limit: 24 },
    }),
  { watch: [page] },
);
if (page.value > 1 && data.value && (page.value - 1) * 24 >= data.value.total)
  throw createError({ statusCode: 404, statusMessage: "Страница не найдена" });
function pageLink(n: number) {
  return { path: "/delivery", query: { page: n > 1 ? String(n) : undefined } };
}
usePageSeo(() => ({
  title: `Готовые блюда с доставкой${page.value > 1 ? ` — страница ${page.value}` : ""} — Nabo`,
  description:
    "Выберите блюдо, посмотрите предложения заведений в Delivio и сравните их с приготовлением дома. Цены и доставка зависят от адреса.",
  noindex: !data.value?.recipes.length,
  schemas: [
    {
      "@type": "ItemList",
      itemListElement:
        data.value?.recipes.map((r, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: origin + `/recipes/${r.slug}#recipe-ready-offers`,
        })) || [],
    },
  ],
}));
</script>
<template>
  <div class="inner-page">
    <div class="page-heading">
      <div>
        <h1>Готовые блюда с доставкой</h1>
        <p class="muted">
          Выберите блюдо: на странице рецепта покажем предложения заведений и
          вариант приготовления дома.
        </p>
      </div>
    </div>
    <div class="dish-grid">
      <NuxtLink
        v-for="(recipe, index) in data?.recipes"
        :key="recipe.slug"
        :to="`/recipes/${recipe.slug}#recipe-ready-offers`"
        class="delivery-dish"
        ><img
          v-if="recipe.image"
          :src="recipe.image"
          :alt="recipe.title"
          :loading="index < 2 ? 'eager' : 'lazy'"
          decoding="async"
          width="400"
          height="280"
        />
        <h2>{{ recipe.title }}</h2>
        <span class="muted">Предложения готового блюда</span></NuxtLink
      >
    </div>
    <nav class="delivery-pagination" aria-label="Страницы блюд">
      <NuxtLink v-if="page > 1" :to="pageLink(page - 1)">Назад</NuxtLink
      ><span>Страница {{ page }}</span
      ><NuxtLink v-if="page * 24 < (data?.total || 0)" :to="pageLink(page + 1)"
        >Дальше</NuxtLink
      >
    </nav>
  </div>
</template>
<style scoped>
.delivery-dish {
  min-width: 0;
  display: block;
}
.delivery-dish img {
  width: 100%;
  height: 180px;
  object-fit: cover;
  border-radius: 16px;
}
.delivery-dish h2 {
  font-size: 17px;
  margin: 12px 0 4px;
}
.delivery-dish span {
  font-size: 12px;
}
.delivery-pagination {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin: 24px 0;
}
</style>
