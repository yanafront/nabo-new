import { requireSameOrigin } from "../../../utils/backend";
import { adminBackendResponse } from "../../../utils/admin-backend";
export default defineEventHandler(async (event) => {
  requireSameOrigin(event);
  const id = getRouterParam(event, "id") || "",
    revision = Number(getQuery(event).revision);
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) ||
    id.length > 40 ||
    !Number.isInteger(revision) ||
    revision < 1
  )
    throw createError({ statusCode: 400 });
  return sendWebResponse(
    event,
    await adminBackendResponse(
      event,
      `/api/admin/recipe-categories/${id}?revision=${revision}`,
      "DELETE",
    ),
  );
});
