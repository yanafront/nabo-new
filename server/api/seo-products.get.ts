import { seoService } from "../utils/seo-service";
import { retailStores } from "../../shared/yandex";
export default defineEventHandler(async (event) => {
  const q = getQuery(event),
    page = Number(q.page || 1),
    storeId = typeof q.storeId === "string" ? q.storeId : "";
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    page > 100000 ||
    (storeId && !retailStores.some((s) => s.id === storeId))
  )
    throw createError({ statusCode: 400 });
  try {
    return await seoService(event, "/api/seo/products", {
      offset: (page - 1) * 24,
      limit: 24,
      ...(storeId ? { storeId } : {}),
    });
  } catch (e: any) {
    if ([404, 405].includes(e.statusCode || e.response?.status))
      return { total: 0, items: [] };
    throw e;
  }
});
