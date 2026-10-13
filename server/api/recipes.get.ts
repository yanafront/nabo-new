import { recipePage } from "../utils/recipe-page";
import { categoriesFor } from "../utils/recipe-categories";
import { recipeCollections } from "../../shared/recipe/model";
export default defineEventHandler(async (event) => {
  const q = getQuery(event);
  const recipeCategories = await categoriesFor(event);
  const number = (v: unknown, fallback: number) =>
    typeof v === "string" && Number.isFinite(Number(v)) ? Number(v) : fallback;
  if (q.view === "categories") {
    const limit = Math.min(6, Math.max(1, number(q.limit, 3)));
    return {
      sections: (
        await Promise.all(
          recipeCategories.map(async (category) => ({
            ...category,
            ...(await recipePage(event, { category: category.id, limit })),
          })),
        )
      ).filter((section) => section.total > 0),
    };
  }
  const result = await recipePage(event, {
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
