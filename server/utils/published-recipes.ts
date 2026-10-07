import {
  recipeCatalogFromDocuments,
  type RecipeDocument,
} from "../../shared/recipe/editor";
import type { H3Event } from "h3";
export async function publishedRecipes(event: H3Event) {
  const config = useRuntimeConfig(event);
  if (!config.recipesApiBase)
    throw createError({
      statusCode: 503,
      message: "Сервис рецептов не настроен. Укажите NUXT_RECIPES_API_BASE.",
    });
  try {
    const data = await $fetch<{ documents: RecipeDocument[] }>(
      `${config.recipesApiBase.replace(/\/+$/, "")}/api/recipe-catalog`,
      { timeout: 15000, retry: 0 },
    );
    if (!Array.isArray(data.documents))
      throw new Error("Invalid recipe catalog");
    return recipeCatalogFromDocuments(data.documents);
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: "Recipe API unavailable",
      message: "Не удалось загрузить рецепты. Попробуйте ещё раз.",
    });
  }
}
