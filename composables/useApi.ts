import { createRequestCache } from "~/utils/request-cache";
import type {
  SearchResult,
  SearchAllResult,
  DeliveryLocation,
  StoreId,
  RetailProduct,
  ProductResult,
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
    indexProducts(response.products, input.location);
    return response;
  }
  function indexProducts(results: RetailProduct[], point: DeliveryLocation) {
    for (const product of results) {
      const until = Math.min(
        Date.now() + 30000,
        Date.parse(product.fetchedAt) + 120000,
      );
      index.set(productKey(product.storeId, product.id, point), {
        product,
        until,
      });
    }
    while (index.size > 500) index.delete(index.keys().next().value!);
  }
  async function searchAllProducts(
    body: { query: string; location: DeliveryLocation },
    signal?: AbortSignal,
  ) {
    const input = {
      query: body.query.trim().toLowerCase(),
      location: { ...body.location },
    };
    const key = JSON.stringify([
      "all-stores",
      input.query,
      input.location.lat,
      input.location.lon,
    ]);
    const response = await request<SearchAllResult>(
      key,
      () =>
        $fetch("/api/search", {
          method: "POST",
          body: input,
          retry: 0,
          timeout: 70000,
        }),
      30000,
      signal,
      (value) =>
        value.stores.length > 0 &&
        value.stores.every((store) => store.status === "ok"),
    );
    for (const store of response.stores)
      indexProducts(store.products, input.location);
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
  function getProduct(
    body: { storeId: StoreId; id: string; location: DeliveryLocation },
    signal?: AbortSignal,
  ) {
    return $fetch<ProductResult>("/api/product", {
      method: "POST",
      body,
      signal,
      retry: 0,
      timeout: 70000,
    });
  }
  async function resolveProducts(
    body: {
      items: Array<{ storeId: StoreId; id: string }>;
      location: DeliveryLocation;
    },
    signal?: AbortSignal,
  ) {
    const unique = [...new Map(body.items.map((item) => [
      JSON.stringify([item.storeId, item.id]), item,
    ])).values()];
    const items: ProductResult[] = [];
    for (let offset = 0; offset < unique.length; offset += 200) {
      const result = await $fetch<{ items: ProductResult[] }>("/api/products/resolve", {
        method: "POST",
        body: { items: unique.slice(offset, offset + 200), location: body.location },
        signal,
        retry: 0,
        timeout: 120000,
      });
      items.push(...result.items);
    }
    return { items };
  }
  return {
    searchProducts,
    searchAllProducts,
    getProduct,
    resolveProducts,
    searchRecipes,
    cachedProduct,
  };
}
