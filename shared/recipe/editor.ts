import type { Recipe, Ingredient, RecipeCatalog } from "./model";
export interface RecipeDocument {
  recipe: Recipe;
  ingredients: Ingredient[];
}
export function mergeRecipeDocuments(
  base: RecipeCatalog,
  documents: RecipeDocument[],
): RecipeCatalog {
  const recipes = new Map(base.recipes.map((r) => [r.slug, r]));
  const ingredients = new Map(base.ingredients.map((i) => [i.id, i]));
  for (const doc of documents) {
    // Scope edited dictionaries to one recipe so another recipe cannot change silently.
    const prefix = `managed:${doc.recipe.slug}:`;
    recipes.set(doc.recipe.slug, {
      ...doc.recipe,
      ingredients: doc.recipe.ingredients.map((i) => ({
        ...i,
        ingredientId: prefix + i.ingredientId,
      })),
    });
    for (const i of doc.ingredients)
      ingredients.set(prefix + i.id, { ...i, id: prefix + i.id });
  }
  return {
    version: 2,
    recipes: [...recipes.values()],
    ingredients: [...ingredients.values()],
  };
}
