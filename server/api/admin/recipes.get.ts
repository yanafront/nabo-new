import { requireSameOrigin } from "../../utils/backend";
import { adminBackendResponse } from "../../utils/admin-backend";
import { recipeCatalog } from "../../utils/recipe-catalog";
export default defineEventHandler(async (event) => {
  requireSameOrigin(event);
  const response = await adminBackendResponse(event, "/api/admin/recipes");
  if (!response.ok) return sendWebResponse(event, response);
  const data = await response.json();
  const photos = useRuntimeConfig(event).recipePhotos;
  return {
    ...data,
    catalog: recipeCatalog,
    catalogEnabled:
      String(useRuntimeConfig(event).managedRecipesEnabled) === "true",
    photosConfigured: !!(
      photos.accountId &&
      photos.accessKeyId &&
      photos.secretAccessKey &&
      photos.bucket &&
      photos.publicBase
    ),
  };
});
