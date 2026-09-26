import { recipeDatabase, searchRecipes, presentRecipe } from "../utils/recipes";

export default defineEventHandler(async (event) => {
  const raw = getQuery(event).q;
  const query = typeof raw === "string" ? raw.trim().slice(0, 100) : "";
  if (query.length < 2) return { recipes: [], total: 501 };
  try {
    const database = await recipeDatabase();
    const people = Number(query.match(/\d+/)?.[0]) || undefined;
    return {
      recipes: searchRecipes(database, query).map((recipe) =>
        presentRecipe(recipe, people),
      ),
      total: database.length,
    };
  } catch {
    throw createError({
      statusCode: 503,
      statusMessage: "База рецептов временно недоступна",
    });
  }
});
