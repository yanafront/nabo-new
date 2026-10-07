import { recipeCatalog } from "./recipe-catalog";
import {
  mergeRecipeDocuments,
  type RecipeDocument,
} from "../../shared/recipe/editor";
import type { H3Event } from "h3";
export async function publishedRecipes(event: H3Event) {
  const config = useRuntimeConfig(event);
  // Enable only after the standalone recipes service is deployed.
  if (String(config.managedRecipesEnabled) !== "true") return recipeCatalog;
  if (!config.recipesApiBase)
    throw createError({
      statusCode: 503,
      message: "Сервис рецептов не настроен.",
    });
  const data = await $fetch<{ documents: RecipeDocument[] }>(
    `${config.recipesApiBase.replace(/\/+$/, "")}/api/recipe-catalog`,
    { timeout: 15000, retry: 0 },
  );
  return mergeRecipeDocuments(recipeCatalog, data.documents);
}
