import {
  retailStores,
  type ProductResult,
  type SearchResult,
} from "../../../../shared/yandex";
import { seoService, rememberProducts } from "../../../utils/seo-service";
const lookup = defineCachedFunction(
  async (base: string, storeId: string, id: string, name: string) => {
    const location = { lat: 53.9, lon: 27.5667, label: "Минск, центр" };
    const result = await $fetch<ProductResult>(
      base.replace(/\/+$/, "") + "/api/product",
      {
        method: "POST",
        body: { storeId, id, location },
        timeout: 15000,
        retry: 0,
      },
    );
    if (
      result.status === "ok" &&
      result.product?.id === id &&
      result.product.storeId === storeId
    )
      return result.product;
    if (result.error === "PRODUCT_LOOKUP_UNSUPPORTED" && name) {
      const found = await $fetch<SearchResult>(
        base.replace(/\/+$/, "") + "/api/yandex/search",
        {
          method: "POST",
          body: { storeId, query: name.slice(0, 160), location },
          timeout: 15000,
          retry: 0,
        },
      );
      const product = found.products.find(
        (p) => p.id === id && p.storeId === storeId,
      );
      if (product) return product;
      if (found.status === "ok")
        throw createError({
          statusCode: 404,
          statusMessage: "Product not found",
        });
    }
    throw createError({
      statusCode: result.status === "not_found" ? 404 : 503,
      statusMessage:
        result.status === "not_found"
          ? "Product not found"
          : "Product service unavailable",
    });
  },
  {
    maxAge: 60,
    swr: false,
    name: "public-product",
    getKey: (base, store, id, name) => JSON.stringify([base, store, id, name]),
  },
);
export default defineEventHandler(async (event) => {
  const storeId = getRouterParam(event, "storeId") || "",
    id = getRouterParam(event, "id", { decode: true }) || "";
  if (!retailStores.some((s) => s.id === storeId) || !id || id.length > 200)
    throw createError({ statusCode: 404 });
  const config = useRuntimeConfig(event),
    q = getQuery(event);
  let name = typeof q.name === "string" ? q.name.slice(0, 160) : "";
  try {
    const known = await seoService(event, "/api/seo/products", {
      storeId,
      id,
      limit: 1,
    });
    name = known.items[0]?.name || name;
  } catch {
    /* ID lookup can work without a discovery index. */
  }
  const product = await lookup(config.retailApiBase, storeId, id, name);
  event.waitUntil(rememberProducts(event, { product }));
  return { product };
});
