import { proxyBackend, requireSameOrigin } from "../../utils/backend";
export default defineEventHandler((event) => {
  requireSameOrigin(event);
  return proxyBackend(event, "/api/products/resolve", "POST");
});
