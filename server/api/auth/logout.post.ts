import { deleteCookie } from "h3";
import { requireSameOrigin } from "../../utils/backend";
export default defineEventHandler(event => {
  requireSameOrigin(event);
  deleteCookie(event, "nabo-session", { path: "/" });
  return { authenticated: false };
});
