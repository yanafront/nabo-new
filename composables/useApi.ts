import { createRequestCache } from "~/utils/request-cache";
import type {
  SearchResult,
  DeliveryLocation,
  StoreId,
  RetailProduct,
} from "~/shared/yandex";
import type { Recipe as RecipeResult } from "~/shared/recipe/model";
const applications = new WeakMap<
  object,
  ReturnType<typeof createRequestCache>
>();
const products = new WeakMap<
  object,
  Map<string, { product: RetailProduct; until: number }>
>();
export function useApi() {
  const app = useNuxtApp();
  if (!applications.has(app)) applications.set(app, createRequestCache());
  if (!products.has(app)) products.set(app, new Map());
  const request = applications.get(app)!;
  const index = products.get(app)!;
  const productKey = (store: string, id: string, point: DeliveryLocation) =>
    JSON.stringify([store, id, point.lat, point.lon]);
  async function searchProducts(
    body: { storeId: StoreId; query: string; location: DeliveryLocation },
    signal?: AbortSignal,
  ) {
    const input = {
      ...body,
      query: body.query.trim().toLowerCase(),
      location: { ...body.location },
    };
    const key = JSON.stringify([
      input.storeId,
      input.query,
      input.location.lat,
      input.location.lon,
    ]);
    const response = await request<SearchResult>(
      key,
      () =>
        $fetch("/api/yandex/search", {
          method: "POST",
          body: input,
          retry: 0,
          timeout: 70000,
        }),
      30000,
      signal,
      (value) => value.status === "ok",
    );
    for (const product of response.products) {
      const until = Math.min(
        Date.now() + 30000,
        Date.parse(product.fetchedAt) + 120000,
      );
      index.set(productKey(product.storeId, product.id, input.location), {
        product,
        until,
      });
    }
    while (index.size > 500) index.delete(index.keys().next().value!);
    return response;
  }
  function cachedProduct(store: string, id: string, point: DeliveryLocation) {
    const entry = index.get(productKey(store, id, point));
    return entry && entry.until > Date.now()
      ? structuredClone(entry.product)
      : null;
  }
  function searchRecipes(query: string, signal?: AbortSignal) {
    const q = query.trim().toLowerCase();
    return request<{ recipes: RecipeResult[] }>(
      `recipe:${q}`,
      () =>
        $fetch("/api/recipes", {
          query: { q },
          retry: 0,
          timeout: 15000,
        }),
      300000,
      signal,
    );
  }
  return { searchProducts, searchRecipes, cachedProduct };
}
