import { createError, getCookie, type H3Event } from "h3";
import { backendResponse } from "./backend";
export async function adminBackendResponse(
  event: H3Event,
  path: string,
  method = "GET",
  body?: unknown,
) {
  if (!getCookie(event, "nabo-session"))
    throw createError({
      statusCode: 401,
      message: "Войдите в служебный аккаунт.",
    });
  const response = await backendResponse(event, path, method, body, "recipes");
  if (response.status === 404)
    throw createError({
      statusCode: 503,
      statusMessage: "Recipe editor unavailable",
      data: {
        message:
          "API редактора ещё не подключён. Требуется выкладка нового бэкенда.",
      },
      message:
        "API редактора ещё не подключён. Требуется выкладка нового бэкенда.",
    });
  return response;
}
