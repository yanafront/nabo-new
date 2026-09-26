import { readBody, sendWebResponse, setCookie, getRequestURL, createError } from "h3";
import { requireSameOrigin, backendResponse } from "../../utils/backend";
export default defineEventHandler(async event => {
  requireSameOrigin(event);
  const response = await backendResponse(event, "/api/auth/login", "POST", await readBody(event));
  if (!response.ok) return sendWebResponse(event, response);
  const result = await response.json() as { accessToken: string; expiresIn: number };
  if (!result.accessToken || !Number.isFinite(result.expiresIn))
    throw createError({ statusCode: 502, statusMessage: "Invalid auth response" });
  setCookie(event, "nabo-session", result.accessToken, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: result.expiresIn,
    secure: getRequestURL(event, { xForwardedProto: true }).protocol === "https:",
  });
  return { authenticated: true };
});
