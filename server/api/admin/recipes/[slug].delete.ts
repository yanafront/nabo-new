import { requireSameOrigin } from "../../../utils/backend";
import { adminBackendResponse } from "../../../utils/admin-backend";
export default defineEventHandler(async (event) => {
  requireSameOrigin(event);
  const slug = getRouterParam(event, "slug") || "";
  const revision = Number(getQuery(event).revision);
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
    slug.length > 100 ||
    !Number.isInteger(revision) ||
    revision < 1 ||
    revision >= 2147483647
  )
    throw createError({
      statusCode: 400,
      message: "Укажите рецепт и его текущую версию.",
    });
  return sendWebResponse(
    event,
    await adminBackendResponse(
      event,
      `/api/admin/recipes/${slug}?revision=${revision}`,
      "DELETE",
    ),
  );
});
