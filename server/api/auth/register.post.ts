import { requireSameOrigin, proxyBackend } from "../../utils/backend";
export default defineEventHandler(event => {
  requireSameOrigin(event);
  return proxyBackend(event, "/api/auth/register", "POST");
});
