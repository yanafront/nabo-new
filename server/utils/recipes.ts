import dataset from "../../data/recipes.json";

interface Localized {
  ru: string;
  en?: string;
}

interface SourceIngredient {
  id: string;
  name: Localized;
  quantity: number | null;
  unit: string;
  scaling: "linear" | "sublinear" | "damped" | "fixed";
}

interface SourceRecipe {
  slug: string;
  country: string;
  name: Localized;
  summary: Localized;
  baseServings: number;
  prepMinutes: number;
  cookMinutes: number;
  ingredients: SourceIngredient[];
  photo: { url: string; author: string; license: string } | null;
}

export interface RecipeSearchResult {
  slug: string;
  name: string;
  summary: string;
  country: string;
  servings: number;
  minutes: number;
  image: string | null;
  ingredients: Array<{ id: string; name: string; amount: string }>;
}

function validRecipe(value: unknown): value is SourceRecipe {
  const recipe = value as SourceRecipe;
  return !!(
    recipe &&
    typeof recipe.slug === "string" &&
    typeof recipe.name?.ru === "string" &&
    Number.isFinite(recipe.baseServings) &&
    Array.isArray(recipe.ingredients)
  );
}

const recipes = (dataset.recipes as unknown[]).filter(validRecipe);
export async function recipeDatabase() {
  if (recipes.length < 400) throw new Error("INVALID_RECIPE_DATA");
  return recipes;
}

const normalize = (value: string) =>
  value
    .toLocaleLowerCase("ru")
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const ignored = new Set(["water", "ice", "salt", "pepper"]);
const units: Record<string, string> = {
  g: "г",
  kg: "кг",
  ml: "мл",
  l: "л",
  piece: "шт",
  clove: "шт",
  slice: "ломтик",
  sprig: "веточка",
  bunch: "пучок",
  tbsp: "ст. л.",
  tsp: "ч. л.",
  cup: "стакан",
  pinch: "щепотка",
  toTaste: "по вкусу",
};

function amount(ingredient: SourceIngredient, factor = 1) {
  if (!Number.isFinite(ingredient.quantity))
    return units[ingredient.unit] || "";
  const value =
    ingredient.scaling === "fixed"
      ? ingredient.quantity!
      : ingredient.quantity! * factor;
  const rounded = Math.round(value * 10) / 10;
  return `${rounded} ${units[ingredient.unit] || ingredient.unit}`.trim();
}

export function presentRecipe(
  recipe: SourceRecipe,
  servings?: number,
): RecipeSearchResult {
  const target = Math.min(30, Math.max(1, servings || recipe.baseServings));
  const factor = target / recipe.baseServings;
  return {
    slug: recipe.slug,
    name: recipe.name.ru,
    summary: recipe.summary?.ru || "",
    country: recipe.country,
    servings: target,
    minutes: (recipe.prepMinutes || 0) + (recipe.cookMinutes || 0),
    image: recipe.photo?.url || null,
    ingredients: recipe.ingredients
      .filter((item) => !ignored.has(item.id) && item.name?.ru)
      .slice(0, 20)
      .map((item) => ({
        id: item.id,
        name: item.name.ru,
        amount: amount(item, factor),
      })),
  };
}

const searchIndex = new WeakMap<SourceRecipe, { name: string; summary: string; ingredients: string }>();

export function searchRecipes(recipes: SourceRecipe[], query: string) {
  const stopWords = new Set([
    "приготовить",
    "рецепт",
    "на",
    "человек",
    "человека",
    "персон",
    "порцию",
    "порции",
    "порций",
  ]);
  const words = normalize(query)
    .split(/\s+/)
    .filter((word) => word.length > 1 && !/^\d+$/.test(word) && !stopWords.has(word));
  if (!words.length) return [];
  return recipes
    .map((recipe) => {
      let entry = searchIndex.get(recipe);
      if (!entry) {
        entry = { name: normalize(recipe.name.ru), summary: normalize(recipe.summary?.ru || ""),
          ingredients: normalize(recipe.ingredients.map(item => item.name?.ru || "").join(" ")) };
        searchIndex.set(recipe, entry);
      }
      const { name, summary, ingredients } = entry;
      const score = words.reduce(
        (sum, word) =>
          sum +
          (name === word
            ? 20
            : name.startsWith(word)
              ? 12
              : name.includes(word)
                ? 8
                : 0) +
          (summary.includes(word) ? 2 : 0) +
          (ingredients.includes(word) ? 1 : 0),
        0,
      );
      return { recipe, score };
    })
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.recipe.name.ru.localeCompare(b.recipe.name.ru, "ru"),
    )
    .slice(0, 8)
    .map(({ recipe }) => recipe);
}
