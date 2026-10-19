import {
  retailStores,
  type SearchBatchResult,
} from "../../../../shared/yandex";
import { discoveredProducts } from "../../../../shared/seo/products";
import { backendResponse } from "../../../utils/backend";
import { requireSeoEditor, seoIndexError } from "../../../utils/seo-admin";
import { saveDiscoveredProducts } from "../../../utils/seo-service";
export default defineEventHandler(async (event) => {
  await requireSeoEditor(event);
  const body = await readBody(event);
  if (
    !body ||
    !retailStores.some((s) => s.id === body.storeId) ||
    !Array.isArray(body.queries) ||
    body.queries.length < 1 ||
    body.queries.length > 5 ||
    body.queries.some(
      (q: unknown) => typeof q !== "string" || !q.trim() || q.length > 120,
    ) ||
    !Number.isFinite(body.location?.lat) ||
    body.location.lat < 51 ||
    body.location.lat > 57 ||
    !Number.isFinite(body.location?.lon) ||
    body.location.lon < 23 ||
    body.location.lon > 33
  )
    throw createError({
      statusCode: 400,
      message:
        "Выберите магазин, адрес в Беларуси и от 1 до 5 запросов до 120 символов.",
    });
  if (!useRuntimeConfig(event).seoIngestKey)
    throw createError({
      statusCode: 503,
      message: "Сначала настройте NUXT_SEO_INGEST_KEY и проверьте связь.",
    });
  const queries = [
    ...new Set<string>(body.queries.map((q: string) => q.trim())),
  ];
  const response = await backendResponse(
    event,
    "/api/yandex/search/batch",
    "POST",
    {
      storeId: body.storeId,
      queries,
      location: {
        lat: body.location.lat,
        lon: body.location.lon,
        label: "Точка поиска",
      },
      limit: 20,
    },
  );
  if (!response.ok)
    throw createError({
      statusCode: 502,
      message: "Поиск магазина недоступен. Повторите попытку.",
    });
  const result = (await response.json()) as SearchBatchResult;
  if (!Array.isArray(result.items))
    throw createError({
      statusCode: 502,
      message: "Магазин вернул некорректный результат поиска.",
    });
  const records = discoveredProducts(result)
    .filter((p) => p.storeId === body.storeId)
    .slice(0, 100);
  try {
    const saved = await saveDiscoveredProducts(event, records);
    return {
      saved,
      queries: queries.length,
      failedQueries: result.items
        .filter((i) => i?.result?.status !== "ok")
        .map((i) => i.query),
    };
  } catch (error) {
    throw seoIndexError(error);
  }
});
