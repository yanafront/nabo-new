import { requireSameOrigin } from "../../../utils/backend";
import { adminBackendResponse } from "../../../utils/admin-backend";
export default defineEventHandler(async (event) => {
  requireSameOrigin(event);
  const slug = getRouterParam(event, "slug") || "";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100)
    throw createError({ statusCode: 400 });
  return sendWebResponse(
    event,
    await adminBackendResponse(
      event,
      `/api/admin/recipes/${slug}`,
      "PUT",
      await readBody(event),
    ),
  );
});
