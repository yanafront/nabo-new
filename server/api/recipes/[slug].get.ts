import { publishedRecipes } from "../../utils/published-recipes";
export default defineEventHandler(async (event) => {
  const recipeCatalog = await publishedRecipes(event);
  const slug = getRouterParam(event, "slug");
  const recipe = recipeCatalog.recipes.find(
    (r) => r.slug === slug && r.isActive,
  );
  if (!recipe)
    throw createError({ statusCode: 404, statusMessage: "Recipe not found" });
  const ids = new Set(recipe.ingredients.map((i) => i.ingredientId));
  return {
    recipe,
    ingredients: recipeCatalog.ingredients.filter((i) => ids.has(i.id)),
  };
});
