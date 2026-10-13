import { recipeCategories } from "~/shared/recipe/model";
export async function useRecipeCategories() {
  const result = await useAsyncData(
    "recipe-taxonomy",
    () =>
      $fetch<{
        categories: Array<{ id: string; title: string; revision?: number }>;
      }>("/api/recipe-categories"),
    { default: () => ({ categories: recipeCategories }) },
  );
  return {
    ...result,
    categories: computed(
      () => result.data.value?.categories || recipeCategories,
    ),
  };
}
