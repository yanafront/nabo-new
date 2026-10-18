import { createError, getQuery } from "h3";
import { proxyBackend } from "../utils/backend";
import { productImageUrl } from "../../shared/product-image";
export default defineEventHandler((event) => {
  const url = getQuery(event).url;
  // Only the catalog CDN needs a proxy. Other hosts must never reach the backend.
  const safe =
    typeof url === "string" && url.length <= 2048 && productImageUrl(url);
  if (!safe || !safe.startsWith("/api/product-image?url="))
    throw createError({ statusCode: 400, statusMessage: "Invalid image URL" });
  return proxyBackend(event, safe);
});
