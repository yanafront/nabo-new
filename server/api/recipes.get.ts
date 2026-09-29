import { recipeCatalog } from "../utils/recipe-catalog";
import { listRecipes } from "../../shared/recipe/search";
import { recipeCategories, recipeCollections } from "../../shared/recipe/model";
export default defineEventHandler((event) => {
  const q = getQuery(event);
  const number = (v: unknown, fallback: number) =>
    typeof v === "string" && Number.isFinite(Number(v)) ? Number(v) : fallback;
  if (q.view === "categories") {
    const limit = Math.min(6, Math.max(1, number(q.limit, 3)));
    return {
      sections: recipeCategories
        .map((category) => ({
          ...category,
          ...listRecipes(recipeCatalog.recipes, recipeCatalog.ingredients, {
            category: category.id,
            limit,
          }),
        }))
        .filter((section) => section.total > 0),
    };
  }
  const result = listRecipes(recipeCatalog.recipes, recipeCatalog.ingredients, {
    q: typeof q.q === "string" ? q.q : "",
    category: typeof q.category === "string" ? q.category : "",
    collection: typeof q.collection === "string" ? q.collection : "",
    offset: number(q.offset, 0),
    limit: number(q.limit, 24),
  });
  return {
    ...result,
    categories: recipeCategories,
    collections: recipeCollections,
  };
});
