<script setup lang="ts">
import { recipeCategories } from "~/shared/recipe/model";
definePageMeta({ key: "recipe-category-catalog" });
const route = useRoute();
if (!recipeCategories.some((c) => c.id === route.params.category))
  throw createError({ statusCode: 404, statusMessage: "Категория не найдена" });
</script>
<template><RecipeCatalogPage /></template>
