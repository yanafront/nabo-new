export type RecipeUnit =
  | "g"
  | "kg"
  | "ml"
  | "l"
  | "piece"
  | "clove"
  | "tbsp"
  | "tsp"
  | "cup"
  | "pinch"
  | "toTaste"
  | "slice"
  | "sprig"
  | "bunch";
export interface Nutrition {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  calculationType: "source" | "calculated";
  basis: "serving" | "recipe" | "100g";
  source: string;
}
export interface Ingredient {
  id: string;
  name: string;
  aliases: string[];
  productCategoryId?: string;
  searchTerms: string[];
  pantry: boolean;
  common: boolean;
  gramsPerPiece?: number;
  gramsPerTablespoon?: number;
  density?: number;
}
export interface RecipeIngredient {
  searchQuery?: string;
  exactName?: string;
  exactUnit?: string;
  ingredientId: string;
  name: string;
  quantity: number;
  unit: RecipeUnit;
  weightGrams?: number;
  categoryId?: string;
  optional?: boolean;
  unquantified?: boolean;
}
export interface Recipe {
  id: string;
  title: string;
  slug: string;
  description?: string;
  image?: string;
  imageAttribution?: string;
  categoryId: string;
  tags: string[];
  cookingTime?: number;
  difficulty?: "easy" | "medium" | "hard";
  servings: number;
  nutrition?: Nutrition;
  yieldGrams?: number;
  ingredients: RecipeIngredient[];
  instructions?: { text: string }[];
  source: string;
  sourceId: string;
  sourceUrl?: string;
  license?: string;
  isActive: boolean;
  shopabilityScore: number;
}
export interface RecipeCatalog {
  version: 2;
  ingredients: Ingredient[];
  recipes: Recipe[];
}
export const recipeCategories = [
  ["breakfast", "Завтраки"],
  ["soups", "Супы"],
  ["mains", "Основные блюда"],
  ["salads", "Салаты"],
  ["pasta", "Паста"],
  ["chicken", "Курица"],
  ["meat", "Мясо"],
  ["fish", "Рыба"],
  ["sides", "Гарниры"],
  ["baking", "Выпечка"],
  ["desserts", "Десерты"],
].map(([id, title]) => ({ id: id!, title: title! }));
export const recipeCollections = [
  ["quick20", "До 20 минут"],
  ["quick30", "До 30 минут"],
  ["budget", "Бюджетно"],
  ["protein", "Много белка"],
  ["light", "До 500 ккал"],
  ["family", "Для семьи"],
  ["easy", "Простые рецепты"],
].map(([id, title]) => ({ id: id!, title: title! }));
export const normalized = (s: string) =>
  s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export function perServing(r: Recipe): Nutrition | undefined {
  const n = r.nutrition;
  if (!n) return;
  const factor =
    n.basis === "serving"
      ? 1
      : n.basis === "recipe"
        ? 1 / r.servings
        : r.yieldGrams
          ? r.yieldGrams / 100 / r.servings
          : undefined;
  if (factor === undefined) return;
  return {
    ...n,
    basis: "serving",
    calories: n.calories * factor,
    protein: n.protein * factor,
    fat: n.fat * factor,
    carbs: n.carbs * factor,
  };
}
export function scaledIngredients(r: Recipe, servings: number) {
  const factor =
    Math.min(30, Math.max(1, Math.trunc(servings) || r.servings)) / r.servings;
  return r.ingredients.map((i) => ({
    ...i,
    quantity: Math.round(i.quantity * factor * 1000) / 1000,
    weightGrams:
      i.weightGrams === undefined ? undefined : i.weightGrams * factor,
  }));
}
const units: Record<string, string> = {
  g: "г",
  kg: "кг",
  ml: "мл",
  l: "л",
  piece: "шт.",
  clove: "зубч.",
  tbsp: "ст. л.",
  tsp: "ч. л.",
  cup: "стак.",
  pinch: "щеп.",
  slice: "ломт.",
  sprig: "вет.",
  bunch: "пуч.",
};
export function ingredientAmount(i: RecipeIngredient) {
  return i.unquantified || i.unit === "toTaste"
    ? "по вкусу"
    : `${new Intl.NumberFormat("ru", { maximumFractionDigits: 1 }).format(i.quantity)} ${units[i.unit] || i.unit}`;
}
