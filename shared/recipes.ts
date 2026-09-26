import type { Item, Product } from "../data/catalog";

export interface RecipeResult {
  slug: string;
  name: string;
  summary: string;
  country: string;
  servings: number;
  minutes: number;
  image: string | null;
  ingredients: Array<{ id: string; name: string; amount: string }>;
}

export function recipeRequest(recipe: RecipeResult): {
  title: string;
  items: Item[];
} {
  return {
    title: `${recipe.name} · ${recipe.servings} порций`,
    items: recipe.ingredients.map((ingredient, index) => {
      const product: Product = {
        id: `recipe:${recipe.slug}:${ingredient.id}:${index}`,
        name: ingredient.name,
        brand: "",
        unit: ingredient.amount || "1 упаковка",
        price: null,
        emoji: "🛒",
        keywords: [],
      };
      return { productId: product.id, quantity: 1, product };
    }),
  };
}
