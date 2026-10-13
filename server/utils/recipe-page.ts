import type { Recipe } from "../../shared/recipe/model";
import type { H3Event } from "h3";
import { seoService } from "./seo-service";
import { publishedRecipes } from "./published-recipes";
import { recipeCatalogFromDocuments } from "../../shared/recipe/editor";
import { listRecipes, type CatalogQuery } from "../../shared/recipe/search";
export async function recipePage(
  event: H3Event,
  input: CatalogQuery,
): Promise<{ recipes: Recipe[]; total: number }> {
  try {
    const data = await seoService(event, "/api/recipe-catalog/page", {
      q: (input.q || "").slice(0, 120),
      category: input.category || "",
      collection: input.collection || "",
      offset: Math.max(0, Math.trunc(input.offset || 0)),
      limit: Math.min(48, Math.max(1, Math.trunc(input.limit || 24))),
    });
    const catalog = recipeCatalogFromDocuments(data.documents);
    return { recipes: catalog.recipes, total: data.total };
  } catch (error: any) {
    if (![404, 405].includes(error.statusCode || error.response?.status))
      throw error;
    const catalog = await publishedRecipes(event);
    return listRecipes(catalog.recipes, catalog.ingredients, input);
  }
}
