import type { H3Event } from "h3";
export interface SeoProductReference {
  storeId: string;
  id: string;
  name: string;
  unit?: string;
  image?: string;
  updatedAt?: string;
}
let cachedRequest: ReturnType<typeof createSeoCache> | undefined;
function createSeoCache() {
  return defineCachedFunction(
    async (
      base: string,
      path: string,
      query: Record<string, string | number>,
    ): Promise<any> =>
      $fetch<any>(base.replace(/\/+$/, "") + path, {
        query,
        timeout: 15000,
        retry: 0,
      }),
    {
      maxAge: 60,
      swr: false,
      name: "seo-public-feed",
      getKey: (base, path, query) => JSON.stringify([base, path, query]),
    },
  );
}
export function seoService(
  event: H3Event,
  path: string,
  query: Record<string, string | number> = {},
): Promise<any> {
  const base = useRuntimeConfig(event).recipesApiBase;
  if (!base)
    throw createError({
      statusCode: 503,
      statusMessage: "Recipes service not configured",
    });
  cachedRequest ||= createSeoCache();
  return cachedRequest(base, path, query);
}
export async function rememberProducts(event: H3Event, data: any) {
  const config = useRuntimeConfig(event);
  if (
    !config.seoIngestKey ||
    !config.recipesApiBase ||
    !config.public.seoIndexable
  )
    return;
  const found = new Map<string, SeoProductReference>();
  function visit(value: any, depth = 0) {
    if (!value || typeof value !== "object" || depth > 8) return;
    if (Array.isArray(value)) {
      value.forEach((v) => visit(v, depth + 1));
      return;
    }
    if (
      typeof value.id === "string" &&
      typeof value.storeId === "string" &&
      typeof value.name === "string" &&
      typeof value.available === "boolean"
    )
      found.set(value.storeId + ":" + value.id, {
        storeId: value.storeId,
        id: value.id,
        name: value.name,
        unit: value.unit || "",
        image:
          typeof value.image === "string" &&
          (value.image.startsWith("https://") ||
            value.image.startsWith("/api/product-image?")) &&
          value.image.length <= 2048
            ? value.image
            : undefined,
      });
    for (const key of ["products", "product", "stores", "items", "result"])
      visit(value[key], depth + 1);
  }
  visit(data);
  if (!found.size) return;
  const records = [...found.values()];
  let cursor = 0;
  await Promise.all(
    Array.from(
      { length: Math.min(2, Math.ceil(records.length / 50)) },
      async () => {
        while (cursor < records.length) {
          const chunk = records.slice(cursor, cursor + 50);
          cursor += 50;
          try {
            await $fetch(
              config.recipesApiBase.replace(/\/+$/, "") + "/api/seo/products",
              {
                method: "POST",
                body: { items: chunk },
                headers: { "X-Nabo-Seo-Key": config.seoIngestKey },
                timeout: 5000,
                retry: 0,
              },
            );
          } catch {
            console.warn("SEO product index update unavailable");
          }
        }
      },
    ),
  );
}
