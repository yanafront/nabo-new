<script setup lang="ts">
import { PRIMARY_SITE_ORIGIN } from "~/shared/seo/core";
import type { Recipe } from "~/shared/recipe/model";
const route = useRoute();
const page = computed(() => Math.max(1, Number(route.query.page) || 1));
const { data, error } = await useAsyncData(
  computed(() => `cook-order-list:${page.value}`),
  () =>
    $fetch<{ recipes: Recipe[]; total: number }>("/api/cook-or-order", {
      query: { page: page.value },
    }),
);
if (error.value)
  throw createError({
    statusCode: 503,
    statusMessage: "Рецепты временно недоступны",
  });
if (page.value > 1 && !data.value?.recipes.length)
  throw createError({ statusCode: 404 });
usePageSeo(() => ({
  title: `Приготовить дома или заказать готовое${page.value > 1 ? ` — страница ${page.value}` : ""} | Nabo`,
  description:
    "Сравните продукты для приготовления дома с предложениями готовых блюд. Реальные цены, порции и время приготовления; условия доставки уточняйте у сервиса.",
  noindex: !data.value?.total,
  schemas: [
    {
      "@type": "ItemList",
      name: "Приготовить или заказать",
      itemListElement:
        data.value?.recipes.map((recipe, index) => ({
          "@type": "ListItem",
          position: (page.value - 1) * 24 + index + 1,
          url: PRIMARY_SITE_ORIGIN + "/cook-or-order/" + recipe.slug,
          name: recipe.title,
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
        { name: 'Приготовить или заказать', path: '/cook-or-order' },
      ]"
    />
    <h1>Приготовить дома или заказать?</h1>
    <p class="muted seo-intro">
      Выберите блюдо, чтобы сопоставить покупку ингредиентов и готовую еду. Для
      приготовления считаем целые упаковки, а в заведениях цена указана за
      предложение из меню. Размеры порций и доставка могут отличаться.
    </p>
    <div class="dish-grid">
      <article
        v-for="(recipe, index) in data?.recipes"
        :key="recipe.slug"
        class="cook-order-choice"
      >
        <RecipeCard :recipe="recipe" :eager="index < 3" /><NuxtLink
          class="text-button"
          :to="`/cook-or-order/${recipe.slug}`"
          >Сравнить варианты <AppIcon name="ArrowRight" :size="16"
        /></NuxtLink>
      </article>
    </div>
    <nav
      v-if="data && data.total > 24"
      class="seo-pagination"
      aria-label="Страницы сравнения"
    >
      <NuxtLink
        v-if="page > 1"
        :to="{ path: route.path, query: page > 2 ? { page: page - 1 } : {} }"
        >Назад</NuxtLink
      ><span>Страница {{ page }}</span
      ><NuxtLink
        v-if="page * 24 < data.total"
        :to="{ path: route.path, query: { page: page + 1 } }"
        >Дальше</NuxtLink
      >
    </nav>
  </div>
</template>
<style scoped>
.cook-order-choice {
  min-width: 0;
}
.cook-order-choice > .text-button {
  margin-top: 10px;
}
</style>
