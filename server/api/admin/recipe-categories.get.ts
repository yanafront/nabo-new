import { requireSameOrigin } from "../../utils/backend";
import { adminBackendResponse } from "../../utils/admin-backend";
export default defineEventHandler(async (event) => {
  requireSameOrigin(event);
  return sendWebResponse(
    event,
    await adminBackendResponse(event, "/api/admin/recipe-categories"),
  );
});
