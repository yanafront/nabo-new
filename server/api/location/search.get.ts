import { photonQueryVariants } from "../../../shared/address-query";
import { createError, defineEventHandler, getQuery, setHeader } from "h3";
import {
  photonAddresses,
  yandexAddresses,
} from "../../../shared/delivery-location";
let nextRequestAt = 0;
// Fixed server-side provider; never forward cookies or arbitrary browser URLs.
export default defineEventHandler(async (event) => {
  setHeader(event, "cache-control", "no-store");
  const q = getQuery(event).q;
  if (typeof q !== "string" || q.trim().length < 5 || q.trim().length > 160)
    throw createError({
      statusCode: 400,
      message: "Введите город, улицу и номер дома.",
    });
  if (Date.now() < nextRequestAt)
    throw createError({
      statusCode: 429,
      message: "Подождите пару секунд перед новым поиском.",
    });
  nextRequestAt = Date.now() + 1500;
  const config = useRuntimeConfig(event);
  const yandex = !!config.yandexGeocoderApiKey;
  const url = yandex
    ? new URL("https://geocode-maps.yandex.ru/v1/")
    : new URL(`${config.geocoderBase.replace(/\/+$/, "")}/api/`);
  if (yandex) {
    url.searchParams.set("apikey", config.yandexGeocoderApiKey);
    url.searchParams.set("geocode", q.trim());
    url.searchParams.set("lang", "ru_RU");
    url.searchParams.set("format", "json");
    url.searchParams.set("bbox", "23,51~33,57");
    url.searchParams.set("rspn", "1");
    url.searchParams.set("results", "5");
  } else {
    url.searchParams.set("q", photonQueryVariants(q)[0]!);
    url.searchParams.set("countrycode", "BY");
    url.searchParams.set("bbox", "23,51,33,57");
    url.searchParams.set("limit", "5");
  }
  try {
    const response = await fetch(url.toString(), {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("Geocoder unavailable");
    let data = await response.json();
    // OSM uses local Belarusian names for many streets. Keep the original
    // as a fallback when the reviewed alternate spelling does not match.
    if (
      !yandex &&
      !photonAddresses(data).length &&
      photonQueryVariants(q).length > 1
    ) {
      url.searchParams.set("q", q.trim());
      const original = await fetch(url.toString(), {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!original.ok) throw new Error("Geocoder unavailable");
      data = await original.json();
    }
    return {
      addresses: yandex ? yandexAddresses(data) : photonAddresses(data),
      provider: yandex ? "yandex" : "photon",
    };
  } catch {
    throw createError({
      statusCode: 502,
      message:
        "Поиск адресов временно недоступен. Попробуйте геолокацию или повторите позже.",
    });
  }
});
