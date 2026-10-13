import { publishedRecipes } from "../../utils/published-recipes";
import { seoService } from "../../utils/seo-service";
import { recipeCatalogFromDocuments } from "../../../shared/recipe/editor";
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug") || "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100)
    throw createError({ statusCode: 404, statusMessage: "Recipe not found" });
  let catalog;
  try {
    const data = await seoService(event, `/api/recipe-catalog/${slug}`);
    catalog = recipeCatalogFromDocuments([data.document]);
  } catch (error: any) {
    if (![404, 405].includes(error.statusCode || error.response?.status))
      throw error;
    let modern = true;
    try {
      await seoService(event, "/api/seo/manifest");
    } catch (probe: any) {
      if ([404, 405].includes(probe.statusCode || probe.response?.status))
        modern = false;
      else throw probe;
    }
    if (modern) throw error;
    catalog = await publishedRecipes(event);
  }
  const recipe = catalog.recipes.find((r) => r.slug === slug && r.isActive);
  if (!recipe)
    throw createError({ statusCode: 404, statusMessage: "Recipe not found" });
  const ids = new Set(recipe.ingredients.map((i) => i.ingredientId));
  return {
    recipe,
    ingredients: catalog.ingredients.filter((i) => ids.has(i.id)),
  };
});
