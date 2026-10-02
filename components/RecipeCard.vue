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
      <span class="dish-tag">{{
        recipeCategories.find((c) => c.id === recipe.categoryId)?.title
      }}</span>
      <h2 :title="recipe.title">{{ recipe.title }}</h2>
      <RecipeNutrition v-if="nutrition" :nutrition="nutrition" compact />
      <p v-else class="muted nutrition-unavailable">
        Пищевая ценность не указана
      </p>
      <div class="dish-bottom">
        <span>{{
          quantityLabel(recipe.servings, "порция", "порции", "порций")
        }}</span
        ><span>{{
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
