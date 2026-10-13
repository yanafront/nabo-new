import type { H3Event } from "h3";
import { recipeCategories } from "~/shared/recipe/model";
import { seoService } from "./seo-service";
export async function categoriesFor(event: H3Event) {
  if (!useRuntimeConfig(event).recipesApiBase) return recipeCategories;
  try {
    const result = await seoService(event, "/api/recipe-categories");
    if (!Array.isArray(result.categories))
      throw createError({ statusCode: 502 });
    return result.categories as Array<{
      id: string;
      title: string;
      revision?: number;
    }>;
  } catch (e: any) {
    if ([404, 405].includes(e.statusCode || e.response?.status))
      return recipeCategories;
    throw e;
  }
}
