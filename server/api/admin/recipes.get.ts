import { requireSameOrigin } from "../../utils/backend";
import { adminBackendResponse } from "../../utils/admin-backend";
export default defineEventHandler(async (event) => {
  requireSameOrigin(event);
  const response = await adminBackendResponse(event, "/api/admin/recipes");
  if (!response.ok) return sendWebResponse(event, response);
  const data = await response.json();
  const photos = useRuntimeConfig(event).recipePhotos;
  return {
    ...data,
    photosConfigured: !!(
      photos.accountId &&
      photos.accessKeyId &&
      photos.secretAccessKey &&
      photos.bucket &&
      photos.publicBase
    ),
  };
});
