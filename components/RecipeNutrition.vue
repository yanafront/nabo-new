<script setup lang="ts">
import type { Nutrition } from "~/shared/recipe/model";
defineProps<{ nutrition: Nutrition; compact?: boolean }>();
const grams = (value: number) =>
  value.toLocaleString("ru-RU", { maximumFractionDigits: 1 });
</script>
<template>
  <div
    class="recipe-nutrition"
    :class="{ compact }"
    aria-label="Пищевая ценность на одну порцию"
  >
    <div class="recipe-energy">
      <strong>{{ Math.round(nutrition.calories) }} <span>ккал</span></strong>
      <small>на одну порцию</small>
    </div>
    <dl class="recipe-macros">
      <div>
        <dt>Белки</dt>
        <dd>{{ grams(nutrition.protein) }} г</dd>
      </div>
      <div>
        <dt>Жиры</dt>
        <dd>{{ grams(nutrition.fat) }} г</dd>
      </div>
      <div>
        <dt>Углеводы</dt>
        <dd>{{ grams(nutrition.carbs) }} г</dd>
      </div>
    </dl>
  </div>
</template>
