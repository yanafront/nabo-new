import type { H3Event } from "h3";
import {
  discoveredProducts,
  type SeoProductReference,
} from "../../shared/seo/products";
export type { SeoProductReference } from "../../shared/seo/products";
import { indexableHost } from "../../shared/seo/core";
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
export async function saveDiscoveredProducts(
  event: H3Event,
  records: SeoProductReference[],
) {
  const config = useRuntimeConfig(event);
  if (!config.seoIngestKey || !config.recipesApiBase)
    throw createError({
      statusCode: 503,
      message:
        "Настройте NUXT_SEO_INGEST_KEY в Vercel и такой же SEO_INGEST_KEY в Railway сервиса nabo-recipes.",
    });
  let saved = 0;
  for (let offset = 0; offset < records.length; offset += 50) {
    const chunk = records.slice(offset, offset + 50);
    const result = await $fetch<{ saved: number }>(
      config.recipesApiBase.replace(/\/+$/, "") + "/api/seo/products",
      {
        method: "POST",
        body: { items: chunk },
        headers: { "X-Nabo-Seo-Key": config.seoIngestKey },
        timeout: 15000,
        retry: 0,
      },
    );
    if (result.saved !== chunk.length)
      throw createError({
        statusCode: 502,
        message: "Некорректный ответ SEO API.",
      });
    saved += result.saved;
  }
  return saved;
}
export async function checkSeoConnection(event: H3Event) {
  const config = useRuntimeConfig(event);
  return $fetch<{ saved: number }>(
    config.recipesApiBase.replace(/\/+$/, "") + "/api/seo/products",
    {
      method: "POST",
      body: { items: [] },
      headers: { "X-Nabo-Seo-Key": config.seoIngestKey },
      timeout: 10000,
      retry: 0,
    },
  );
}
export async function rememberProducts(event: H3Event, data: unknown) {
  const config = useRuntimeConfig(event);
  if (
    !config.seoIngestKey ||
    !config.recipesApiBase ||
    !indexableHost(getRequestURL(event).hostname, config.public.seoIndexable)
  )
    return;
  const records = discoveredProducts(data);
  if (!records.length) return;
  try {
    await saveDiscoveredProducts(event, records);
  } catch (error: any) {
    // Log only a status, never keys, provider payloads or personal data.
    console.warn(
      "SEO product index update unavailable",
      error.statusCode || error.response?.status || 502,
    );
  }
}
