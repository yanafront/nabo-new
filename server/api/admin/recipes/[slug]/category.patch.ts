import { requireSameOrigin } from "../../../../utils/backend";
import { adminBackendResponse } from "../../../../utils/admin-backend";

export default defineEventHandler(async (event) => {
  requireSameOrigin(event);
  const slug = getRouterParam(event, "slug") || "";
  const body = await readBody(event);
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
    slug.length > 100 ||
    !body ||
    typeof body.categoryId !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.categoryId) ||
    body.categoryId.length > 40 ||
    !Number.isInteger(body.revision) ||
    body.revision < 1 ||
    body.revision >= 2147483647
  )
    throw createError({
      statusCode: 400,
      message: "Проверьте категорию и версию рецепта.",
    });
  return sendWebResponse(
    event,
    await adminBackendResponse(
      event,
      `/api/admin/recipes/${slug}/category`,
      "PATCH",
      { categoryId: body.categoryId, revision: body.revision },
    ),
  );
});
