import { deleteCookie, setHeader, sendWebResponse } from "h3";
import { backendResponse } from "../../utils/backend";
export default defineEventHandler(async event => {
  setHeader(event, "cache-control", "no-store");
  const response = await backendResponse(event, "/api/auth/me");
  if (response.status === 401) deleteCookie(event, "nabo-session", { path: "/" });
  return sendWebResponse(event, response);
});
