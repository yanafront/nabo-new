import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useApi } from "../composables/useApi";
import { retailStores, type SearchAllResult } from "../shared/yandex";
const point = { lat: 53.9, lon: 27.5667, label: "Дом" };
const response = (): SearchAllResult => ({
  stores: retailStores.map((store) => ({
    storeId: store.id,
    placeSlug: store.slug,
    status: "ok",
    currency: "BYN",
    fetchedAt: new Date().toISOString(),
    products: [
      {
        id: "milk",
        storeId: store.id,
        placeSlug: store.slug,
        name: "Молоко",
        unit: "1 л",
        price: 3,
        oldPrice: null,
        image: null,
        stock: 5,
        available: true,
        fetchedAt: new Date().toISOString(),
      },
    ],
  })),
});
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  const app = {};
  vi.stubGlobal("useNuxtApp", () => app);
  fetchMock = vi.fn().mockImplementation(async () => response());
  vi.stubGlobal("$fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
it("searches all stores once, preserves store identities and caches normalized queries", async () => {
  const api = useApi();
  const result = await api.searchAllProducts({
    query: " МОЛОКО ",
    location: point,
  });
  expect(result.stores).toHaveLength(6);
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/search",
    expect.objectContaining({
      method: "POST",
      body: { query: "молоко", location: point },
    }),
  );
  await api.searchAllProducts({ query: "молоко", location: point });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  for (const store of retailStores)
    expect(api.cachedProduct(store.id, "milk", point)?.storeId).toBe(store.id);
});
it("does not reuse products or results for another delivery point", async () => {
  const api = useApi();
  await api.searchAllProducts({ query: "молоко", location: point });
  const other = { ...point, lat: 53.95 };
  expect(api.cachedProduct("green", "milk", other)).toBeNull();
  await api.searchAllProducts({ query: "молоко", location: other });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
it("keeps successful stores in a partial response and retries failed stores on the next search", async () => {
  const partial = response();
  partial.stores[0] = {
    ...partial.stores[0]!,
    status: "error",
    products: [],
    error: "timeout",
  };
  fetchMock.mockResolvedValueOnce(partial);
  const api = useApi();
  const result = await api.searchAllProducts({
    query: "молоко",
    location: point,
  });
  expect(result.stores.filter((store) => store.status === "ok")).toHaveLength(
    5,
  );
  expect(api.cachedProduct("green", "milk", point)).not.toBeNull();
  expect(api.cachedProduct("sosedi", "milk", point)).toBeNull();
  const retry = await api.searchAllProducts({
    query: "молоко",
    location: point,
  });
  expect(retry.stores.every((store) => store.status === "ok")).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
