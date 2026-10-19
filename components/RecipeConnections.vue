<script setup lang="ts">
import type { Recipe } from "~/shared/recipe/model";
import { relatedRecipes, ingredientTopic } from "~/shared/seo/topics";
const props = defineProps<{ recipe: Recipe }>();
const { data } = await useAsyncData(`related:${props.recipe.slug}`, () =>
  $fetch<{ recipes: Recipe[] }>("/api/recipes", {
    query: { category: props.recipe.categoryId, limit: 6 },
  }).catch(() => ({ recipes: [] })),
);
const related = computed(() =>
  relatedRecipes(props.recipe, data.value?.recipes || []),
);
const ingredients = computed(() => [
  ...new Map(
    props.recipe.ingredients.flatMap((i) => {
      const topic = ingredientTopic(i.name);
      return topic ? [[topic.slug, topic] as const] : [];
    }),
  ).values(),
]);
</script>
<template>
  <section class="seo-section">
    <h2>Продолжить с этим блюдом</h2>
    <nav class="seo-links" aria-label="Продукты и сравнение">
      <NuxtLink :to="`/cook-or-order/${recipe.slug}`"
        >{{ recipe.title }}: приготовить или заказать</NuxtLink
      ><NuxtLink
        v-for="topic in ingredients"
        :key="topic.slug"
        :to="`/products/${topic.slug}`"
        >{{ topic.name }}</NuxtLink
      ><NuxtLink to="/stores">Выбрать магазин</NuxtLink>
    </nav>
    <template v-if="related.length"
      ><h2>Похожие рецепты</h2>
      <div class="dish-grid">
        <RecipeCard
          v-for="other in related"
          :key="other.slug"
          :recipe="other"
        /></div
    ></template>
  </section>
</template>
