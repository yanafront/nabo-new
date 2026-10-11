import { searchDelivio } from "../../utils/delivio";
export default defineEventHandler(async (event) => {
  const input = getQuery(event);
  const q = typeof input.q === "string" ? input.q.trim() : "";
  const lat = Number(input.lat),
    lon = Number(input.lon);
  if (
    q.length < 3 ||
    q.length > 150 ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < 51 ||
    lat > 57 ||
    lon < 23 ||
    lon > 33
  )
    throw createError({
      statusCode: 400,
      message: "Укажите название блюда и точку доставки в Беларуси.",
    });
  setHeader(event, "Cache-Control", "no-store");
  try {
    return await searchDelivio(q, lat, lon);
  } catch {
    throw createError({
      statusCode: 502,
      message: "Предложения Delivio временно недоступны.",
    });
  }
});
