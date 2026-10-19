<script setup lang="ts">
import {
  perServing,
  recipeCategories,
  type Recipe,
} from "~/shared/recipe/model";
const props = defineProps<{
  recipe: Recipe;
  eager?: boolean;
  deferImage?: boolean;
  categoryTitle?: string;
  contextQuery?: Record<string, string | number>;
}>();
const nutrition = computed(() => perServing(props.recipe));
const grams = (value: number) => Math.round(value).toLocaleString("ru-RU");
const failed = ref(false);
const photo = ref<HTMLElement>();
const showImage = ref(!props.deferImage);
let observer: IntersectionObserver | undefined;
onMounted(() => {
  if (!props.deferImage || !photo.value) return;
  if (!("IntersectionObserver" in window)) {
    showImage.value = true;
    return;
  }
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        showImage.value = true;
        observer?.disconnect();
      }
    },
    { rootMargin: "0px" },
  );
  observer.observe(photo.value);
});
onBeforeUnmount(() => observer?.disconnect());
</script>
<template>
  <NuxtLink
    :to="{ path: `/recipes/${recipe.slug}`, query: contextQuery || {} }"
    class="dish-card"
  >
    <div ref="photo" class="dish-photo">
      <img
        v-if="recipe.image && !failed && showImage"
        :src="recipe.image"
        :alt="recipe.title"
        width="640"
        height="480"
        :loading="eager ? 'eager' : 'lazy'"
        decoding="async"
        @error="failed = true"
      />
      <div v-else class="dish-placeholder">
        <AppIcon name="ShoppingBasket" :size="40" /><span>{{
          categoryTitle ||
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
