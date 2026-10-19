import type { H3Event } from "h3";
import type { ProductResult } from "../../shared/yandex";
import type { SeoProductReference } from "../../shared/seo/products";
let cache: ReturnType<typeof createCache> | undefined;
function createCache() {
  return defineCachedFunction(
    async (base: string, items: Array<{ storeId: string; id: string }>) => {
      const response = await $fetch<{ items: ProductResult[] }>(
        base.replace(/\/+$/, "") + "/api/products/resolve",
        {
          method: "POST",
          body: {
            items,
            location: { lat: 53.9, lon: 27.5667, label: "Минск, центр" },
          },
          timeout: 5000,
          retry: 0,
        },
      );
      return response.items.filter(
        (item) =>
          item.status === "ok" &&
          item.product &&
          Number.isFinite(item.product.price),
      );
    },
    {
      name: "public-product-prices",
      maxAge: 120,
      swr: true,
      getKey: (base, items) => JSON.stringify([base, items]),
    },
  );
}
export async function publicPrices(
  event: H3Event,
  references: SeoProductReference[],
): Promise<ProductResult[]> {
  if (!references.length) return [];
  cache ||= createCache();
  const task = cache(
    useRuntimeConfig(event).retailApiBase,
    references.slice(0, 6).map((p) => ({ storeId: p.storeId, id: p.id })),
  ).catch(() => []);
  event.waitUntil(task);
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      task,
      new Promise<ProductResult[]>((resolve) => {
        timer = setTimeout(() => resolve([]), 800);
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}
