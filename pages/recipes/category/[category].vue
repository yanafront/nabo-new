<script setup lang="ts">
const { categories: recipeCategories } = await useRecipeCategories();
definePageMeta({ key: "recipe-category-catalog" });
const route = useRoute();
if (!recipeCategories.value.some((c) => c.id === route.params.category))
  throw createError({ statusCode: 404, statusMessage: "Категория не найдена" });
</script>
<template><RecipeCatalogPage /></template>
