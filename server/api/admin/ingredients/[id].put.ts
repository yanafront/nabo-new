import { requireSameOrigin } from "../../../utils/backend";
import { adminBackendResponse } from "../../../utils/admin-backend";
export default defineEventHandler(async (event) => {
  requireSameOrigin(event);
  const id = getRouterParam(event, "id") || "";
  const body = await readBody(event);
  if (
    !/^[a-f0-9]{64}$/.test(id) ||
    !body ||
    typeof body.searchQuery !== "string" ||
    !body.searchQuery.trim() ||
    body.searchQuery.trim().length > 160 ||
    !Number.isInteger(body.revision) ||
    body.revision < 1 ||
    body.revision >= 2147483647
  )
    throw createError({ statusCode: 400 });
  return sendWebResponse(
    event,
    await adminBackendResponse(event, `/api/admin/ingredients/${id}`, "PUT", {
      searchQuery: body.searchQuery.trim(),
      revision: body.revision,
    }),
  );
});
