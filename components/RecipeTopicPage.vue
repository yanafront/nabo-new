<script setup lang="ts">
import { PRIMARY_SITE_ORIGIN } from "~/shared/seo/core";
import { recipeTopic } from "~/shared/seo/topics";
import type { Recipe } from "~/shared/recipe/model";
const props = defineProps<{ topic: string }>();
const topic = recipeTopic(props.topic)!;
const route = useRoute();
const page = computed(() => Math.max(1, Number(route.query.page) || 1));
const { data, error } = await useAsyncData(
  computed(() => `recipe-topic:${topic.slug}:${page.value}`),
  () =>
    $fetch<{ recipes: Recipe[]; total: number }>("/api/recipes", {
      query: {
        ...("collection" in topic
          ? { collection: topic.collection }
          : { category: topic.category }),
        offset: (page.value - 1) * 24,
        limit: 24,
      },
    }),
);
if (error.value)
  throw createError({
    statusCode: 503,
    statusMessage: "Каталог временно недоступен",
  });
if (page.value > 1 && !data.value?.recipes.length)
  throw createError({ statusCode: 404 });
usePageSeo(() => ({
  title: `${topic.title}${page.value > 1 ? ` — страница ${page.value}` : ""} | Nabo`,
  description: topic.description,
  noindex: !data.value?.total,
  schemas: [
    {
      "@type": "ItemList",
      name: topic.title,
      itemListElement:
        data.value?.recipes.map((recipe, index) => ({
          "@type": "ListItem",
          position: (page.value - 1) * 24 + index + 1,
          url: PRIMARY_SITE_ORIGIN + "/recipes/" + recipe.slug,
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
        { name: 'Рецепты', path: '/recipes' },
        { name: topic.title, path: `/recipes/${topic.slug}` },
      ]"
    />
    <h1>{{ topic.title }}</h1>
    <p class="muted seo-intro">{{ topic.description }}</p>
    <div v-if="data?.recipes.length" class="dish-grid">
      <RecipeCard
        v-for="(recipe, index) in data.recipes"
        :key="recipe.slug"
        :recipe="recipe"
        :eager="index < 3"
      />
    </div>
    <p v-else>
      В этой подборке пока нет опубликованных рецептов.
      <NuxtLink to="/recipes">Посмотреть все блюда</NuxtLink>
    </p>
    <nav
      v-if="data && data.total > 24"
      class="seo-pagination"
      aria-label="Страницы рецептов"
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
    <NuxtLink to="/cook-or-order" class="text-button"
      >Приготовить или заказать</NuxtLink
    >
  </div>
</template>
