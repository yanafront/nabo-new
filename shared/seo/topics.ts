import { normalized, type Recipe } from "../recipe/model";
// A finite, editorial vocabulary; search strings never create indexable routes.
export const productTopics = [
  {
    slug: "moloko",
    name: "Молоко",
    prefix: "молоко",
    query: "Молоко",
    ingredient: /^молок/,
  },
  {
    slug: "tvorog",
    name: "Творог",
    prefix: "творог",
    query: "Творог",
    ingredient: /^творог/,
  },
  {
    slug: "smetana",
    name: "Сметана",
    prefix: "сметана",
    query: "Сметана",
    ingredient: /^сметан/,
  },
  {
    slug: "yaytsa",
    name: "Яйца куриные",
    prefix: "яйца куриные",
    query: "Яйца куриные",
    ingredient: /^яйц/,
  },
  {
    slug: "kurinoe-file",
    name: "Куриное филе",
    prefix: "филе цыпленка",
    query: "Филе куриное",
    ingredient: /^(курин.*филе|филе.*кур|куриная груд)/,
  },
  {
    slug: "kartofel",
    name: "Картофель",
    prefix: "картофель",
    query: "Картофель",
    ingredient: /^картоф/,
  },
  {
    slug: "muka",
    name: "Мука пшеничная",
    prefix: "мука пшеничная",
    query: "Мука пшеничная",
    ingredient: /^мука/,
  },
  {
    slug: "maslo-slivochnoe",
    name: "Масло сливочное",
    prefix: "масло сливочное",
    query: "Масло сливочное",
    ingredient: /^(масло слив|сливочное масло)/,
  },
] as const;
export function productTopic(slug: unknown) {
  return productTopics.find((topic) => topic.slug === slug);
}
export function ingredientTopic(name: string) {
  return productTopics.find((topic) => topic.ingredient.test(normalized(name)));
}
export const recipeTopics = [
  {
    slug: "quick",
    title: "Быстрые рецепты до 20 минут",
    description:
      "Блюда с указанным временем приготовления до 20 минут. Выберите рецепт и соберите ингредиенты для покупки.",
    collection: "quick20",
  },
  {
    slug: "budget",
    title: "Недорогие рецепты",
    description:
      "Рецепты из бюджетной подборки Nabo. Фактическая стоимость зависит от магазина и размера упаковок — проверьте её на странице блюда.",
    collection: "budget",
  },
  {
    slug: "high-protein",
    title: "Рецепты с высоким содержанием белка",
    description:
      "Блюда с 25 г белка и более на порцию по указанным в рецепте КБЖУ. Состав и порции доступны внутри рецепта.",
    collection: "protein",
  },
  {
    slug: "lunch",
    title: "Что приготовить на обед",
    description:
      "Рецепты, отмеченные редакцией для обеда: ингредиенты, пошаговое приготовление и продукты для корзины.",
    category: "lunch",
  },
  {
    slug: "dinner",
    title: "Что приготовить на ужин",
    description:
      "Рецепты, отмеченные редакцией для ужина. Выберите блюдо, проверьте ингредиенты и сравните покупку продуктов с заказом готовой еды.",
    category: "dinner",
  },
] as const;
export function recipeTopic(slug: unknown) {
  return recipeTopics.find((topic) => topic.slug === slug);
}
export function relatedRecipes(recipe: Recipe, candidates: Recipe[]) {
  const ids = new Set(recipe.ingredients.map((i) => i.ingredientId));
  return candidates
    .filter((r) => r.slug !== recipe.slug)
    .map((r) => ({
      r,
      score:
        r.ingredients.filter((i) => ids.has(i.ingredientId)).length +
        (r.categoryId === recipe.categoryId ? 2 : 0),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.r.slug.localeCompare(b.r.slug))
    .slice(0, 3)
    .map((r) => r.r);
}
