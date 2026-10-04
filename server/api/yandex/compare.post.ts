import { proxyBackend, requireSameOrigin } from "../../utils/backend";

// The backend owns selection, alternatives and quantities, including recipes.
export default defineEventHandler((event) => {
  requireSameOrigin(event);
  return proxyBackend(event, "/api/yandex/compare", "POST");
});
