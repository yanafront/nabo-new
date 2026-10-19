import { recipeDetail } from "../../utils/recipe-detail";
import type { Recipe, Ingredient } from "../../../shared/recipe/model";
import type { SearchBatchResult } from "../../../shared/yandex";
import { recipePurchaseRequest } from "../../../shared/recipe/purchasing";
import {
  recipePriceQuery,
  recipeStorePrice,
} from "../../../shared/recipe-store-price";
import { searchDelivio } from "../../utils/delivio";
let prices: ReturnType<typeof createPrices> | undefined;
function createPrices() {
  return defineCachedFunction(
    async (base: string, recipe: Recipe, ingredients: Ingredient[]) => {
      const excluded = recipe.ingredients.flatMap((i, index) =>
        ingredients.find((d) => d.id === i.ingredientId)?.pantry
          ? [String(index)]
          : [],
      );
      const request = recipePurchaseRequest(
        recipe,
        ingredients,
        recipe.servings,
        excluded,
      );
      const queries = [...new Set(request.items.map(recipePriceQuery))];
      if (!queries.length || queries.length > 20) return null;
      const result = await $fetch<SearchBatchResult>(
        `${base.replace(/\/+$/, "")}/api/yandex/search/batch`,
        {
          method: "POST",
          body: {
            storeId: "evroopt",
            queries,
            location: { lat: 53.9, lon: 27.5667, label: "Минск, центр" },
          },
          timeout: 5000,
          retry: 0,
        },
      );
      const found = Object.fromEntries(
        result.items
          .filter((i) => i.result.storeId === "evroopt")
          .map((i) => [i.query, i.result]),
      );
      const estimate = recipeStorePrice(request.items, found);
      return estimate.complete
        ? {
            total: estimate.total,
            perServing:
              Math.round((estimate.total / recipe.servings) * 100) / 100,
            storeId: "evroopt",
            checkedAt: new Date().toISOString(),
            pantryExcluded: excluded.length,
          }
        : null;
    },
    {
      name: "public-cook-price",
      maxAge: 300,
      swr: true,
      getKey: (base, recipe, ingredients) =>
        JSON.stringify([base, recipe, ingredients]),
    },
  );
}
export default defineEventHandler(async (event): Promise<any> => {
  const slug = getRouterParam(event, "slug") || "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100)
    throw createError({ statusCode: 404 });
  const data = await recipeDetail(event, slug);
  const config = useRuntimeConfig(event);
  prices ||= createPrices();
  const homeTask = prices(
    config.retailApiBase,
    data.recipe,
    data.ingredients,
  ).catch(() => null);
  const diningTask = searchDelivio(
    data.recipe.title,
    53.9,
    27.5667,
    config.diningApiBase,
  ).catch(() => null);
  event.waitUntil(Promise.allSettled([homeTask, diningTask]));
  async function deadline<T>(task: Promise<T>): Promise<T | null> {
    let timer: ReturnType<typeof setTimeout>;
    try {
      return await Promise.race([
        task,
        new Promise<null>((resolve) => {
          timer = setTimeout(() => resolve(null), 1000);
        }),
      ]);
    } finally {
      clearTimeout(timer!);
    }
  }
  const [home, dining] = await Promise.all([
    deadline(homeTask),
    deadline(diningTask),
  ]);
  return {
    ...data,
    home,
    dining,
    location: { lat: 53.9, lon: 27.5667, label: "Минск, центр" },
  };
});
