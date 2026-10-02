import { getQuery, setHeader, sendWebResponse, createError } from "h3";
import { backendResponse } from "../utils/backend";
export default defineEventHandler(async (event) => {
  setHeader(event, "cache-control", "no-store");
  const { lat, lon } = getQuery(event);
  const query = new URLSearchParams();
  if (lat !== undefined || lon !== undefined) {
    if (
      typeof lat !== "string" ||
      typeof lon !== "string" ||
      !lat.trim() ||
      !lon.trim() ||
      !Number.isFinite(Number(lat)) ||
      !Number.isFinite(Number(lon)) ||
      Number(lat) < 51 ||
      Number(lat) > 57 ||
      Number(lon) < 23 ||
      Number(lon) > 33
    )
      throw createError({
        statusCode: 400,
        message: "Укажите координаты доставки в Беларуси.",
      });
    query.set("lat", lat);
    query.set("lon", lon);
  }
  return sendWebResponse(
    event,
    await backendResponse(
      event,
      `/api/cart/getCart${query.size ? "?" + query : ""}`,
    ),
  );
});
