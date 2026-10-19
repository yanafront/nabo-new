import type { H3Event } from "h3";
import { requireSameOrigin } from "./backend";
import { adminBackendResponse } from "./admin-backend";
export async function requireSeoEditor(event: H3Event) {
  requireSameOrigin(event);
  const access = await adminBackendResponse(event, "/api/admin/recipes/access");
  if (!access.ok)
    throw createError({
      statusCode: access.status,
      message: "Нет доступа к SEO-индексу.",
    });
  if ((await access.json()).authorized !== true)
    throw createError({ statusCode: 403 });
}
export function seoIndexError(error: any) {
  const status = error.statusCode || error.response?.status;
  return createError({
    statusCode: status === 401 || status === 403 ? 502 : 503,
    message:
      status === 401 || status === 403
        ? "Бэкенд отклонил ключ. Проверьте, что NUXT_SEO_INGEST_KEY в Vercel совпадает с SEO_INGEST_KEY в Railway сервиса nabo-recipes. После изменения нужен redeploy."
        : "SEO API недоступен. Проверьте адрес сервиса рецептов и его деплой.",
  });
}
