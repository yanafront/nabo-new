import {
  createError,
  getCookie,
  getRequestURL,
  readBody,
  setHeader,
  sendWebResponse,
  type H3Event,
} from "h3";

// Only fixed, application-owned paths are passed here, never a browser-supplied URL.
export async function backendResponse(
  event: H3Event,
  path: string,
  method = "GET",
  body?: unknown,
  service: "retail" | "recipes" = "retail",
) {
  const config = useRuntimeConfig(event);
  const base = (
    service === "recipes" ? config.recipesApiBase : config.retailApiBase
  ).replace(/\/+$/, "");
  if (!base)
    throw createError({
      statusCode: 503,
      message: "API редактора ещё не подключён. Укажите NUXT_RECIPES_API_BASE.",
    });
  const headers = new Headers({ accept: "application/json" });
  if (body !== undefined) headers.set("content-type", "application/json");
  const token = getCookie(event, "nabo-session");
  if (token) headers.set("authorization", `Bearer ${token}`);
  try {
    return await fetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(
        path.includes("compare") ||
          path.includes("resolve") ||
          path.includes("getCart")
          ? 115000
          : 65000,
      ),
    });
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: "Backend unavailable",
      message: "Сервер временно недоступен. Попробуйте ещё раз.",
    });
  }
}

export async function proxyBackend(
  event: H3Event,
  path: string,
  method = "GET",
) {
  const body = ["POST", "PUT", "PATCH", "DELETE"].includes(method)
    ? await readBody(event)
    : undefined;
  const response = await backendResponse(event, path, method, body);
  // Preserve backend status, validation bodies, Retry-After and image headers.
  return sendWebResponse(event, response);
}

export function requireSameOrigin(event: H3Event) {
  const origin = event.headers.get("origin");
  if (
    origin &&
    origin !==
      getRequestURL(event, { xForwardedHost: true, xForwardedProto: true })
        .origin
  )
    throw createError({ statusCode: 403, statusMessage: "Forbidden origin" });
  setHeader(event, "cache-control", "no-store");
}
