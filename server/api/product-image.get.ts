import { getQuery } from "h3";
import { proxyBackend } from "../utils/backend";
export default defineEventHandler(event => {
  const url = getQuery(event).url;
  return proxyBackend(event, `/api/product-image?url=${encodeURIComponent(typeof url === "string" ? url : "")}`);
});
