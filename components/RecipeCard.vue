<script setup lang="ts">
import {
  perServing,
  recipeCategories,
  type Recipe,
} from "~/shared/recipe/model";
const props = defineProps<{
  recipe: Recipe;
  contextQuery?: Record<string, string | number>;
}>();
const nutrition = computed(() => perServing(props.recipe));
const grams = (value: number) => Math.round(value).toLocaleString("ru-RU");
const failed = ref(false);
</script>
<template>
  <NuxtLink
    :to="{ path: `/recipes/${recipe.slug}`, query: contextQuery || {} }"
    class="dish-card"
  >
    <div class="dish-photo">
      <img
        v-if="recipe.image && !failed"
        :src="recipe.image"
        alt=""
        loading="lazy"
        decoding="async"
        @error="failed = true"
      />
      <div v-else class="dish-placeholder">
        <AppIcon name="ShoppingBasket" :size="40" /><span>{{
          recipeCategories.find((c) => c.id === recipe.categoryId)?.title
        }}</span>
      </div>
      <span v-if="recipe.cookingTime !== undefined" class="dish-time"
        ><AppIcon name="Clock" :size="14" />{{ recipe.cookingTime }} мин</span
      >
    </div>
    <div class="dish-info">
      <h2 :title="recipe.title">{{ recipe.title }}</h2>
      <div
        v-if="nutrition"
        class="dish-nutrition"
        aria-label="КБЖУ на одну порцию"
      >
        <strong
          >{{ Math.round(nutrition.calories) }} ккал<span>
            / порция</span
          ></strong
        >
        <span class="dish-macros">
          <span
            ><abbr title="Белки">Б</abbr> {{ grams(nutrition.protein) }} г</span
          >
          <span><abbr title="Жиры">Ж</abbr> {{ grams(nutrition.fat) }} г</span>
          <span
            ><abbr title="Углеводы">У</abbr>
            {{ grams(nutrition.carbs) }} г</span
          >
        </span>
      </div>
      <div class="dish-bottom">
        <span>{{
          quantityLabel(recipe.servings, "порция", "порции", "порций")
        }}</span>
        <span>{{
          quantityLabel(
            recipe.ingredients.length,
            "ингредиент",
            "ингредиента",
            "ингредиентов",
          )
        }}</span>
      </div>
    </div>
  </NuxtLink>
</template>
