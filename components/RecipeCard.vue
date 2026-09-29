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
        recipe.shopabilityScore >= 80
          ? "Из привычных продуктов"
          : recipeCategories.find((c) => c.id === recipe.categoryId)?.title
      }}</span>
      <h2>{{ recipe.title }}</h2>
      <div v-if="nutrition" class="dish-nutrition">
        <strong>{{ Math.round(nutrition.calories) }} ккал</strong
        ><span
          >Б {{ Math.round(nutrition.protein) }} · Ж
          {{ Math.round(nutrition.fat) }} · У
          {{ Math.round(nutrition.carbs) }}</span
        ><small>на порцию</small>
      </div>
      <p v-else class="muted nutrition-unavailable">
        КБЖУ не указаны источником
      </p>
      <div class="dish-bottom">
        <span>{{
          quantityLabel(recipe.servings, "порция", "порции", "порций")
        }}</span
        ><span class="dish-action"
          >Открыть рецепт <AppIcon name="ArrowRight" :size="16"
        /></span>
      </div>
    </div>
  </NuxtLink>
</template>
