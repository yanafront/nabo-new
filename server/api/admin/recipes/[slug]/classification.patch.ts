import { requireSameOrigin } from "../../../../utils/backend";
import { adminBackendResponse } from "../../../../utils/admin-backend";
import { recipeCollections } from "../../../../../shared/recipe/model";
export default defineEventHandler(async (event) => {
  requireSameOrigin(event);
  const slug = getRouterParam(event, "slug") || "";
  const body = await readBody(event);
  const changes = body?.collections;
  const validChanges =
    changes &&
    Array.isArray(changes.add) &&
    Array.isArray(changes.remove) &&
    changes.add.length + changes.remove.length <= recipeCollections.length &&
    new Set([...changes.add, ...changes.remove]).size ===
      changes.add.length + changes.remove.length &&
    [...changes.add, ...changes.remove].every((id) =>
      recipeCollections.some((c) => c.id === id),
    );
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
    slug.length > 100 ||
    !body ||
    (body.categoryId !== undefined &&
      (typeof body.categoryId !== "string" ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.categoryId) ||
        body.categoryId.length > 40)) ||
    !Number.isInteger(body.revision) ||
    body.revision < 1 ||
    body.revision >= 2147483647 ||
    (changes !== undefined && !validChanges) ||
    (body.categoryId === undefined &&
      (!validChanges || changes.add.length + changes.remove.length === 0))
  )
    throw createError({
      statusCode: 400,
      message: "Проверьте категорию, подборки и версию рецепта.",
    });
  return sendWebResponse(
    event,
    await adminBackendResponse(
      event,
      `/api/admin/recipes/${slug}/classification`,
      "PATCH",
      {
        categoryId: body.categoryId,
        collections: changes,
        revision: body.revision,
      },
    ),
  );
});
