import {
  delivioOffers,
  delivioSearchUrl,
  type DiningResult,
} from "../../shared/dining/delivio";
const cache = new Map<string, { until: number; result: DiningResult }>();
const inFlight = new Map<string, Promise<DiningResult>>();
export async function searchDelivio(
  query: string,
  lat: number,
  lon: number,
  base = "https://delivio.by",
): Promise<DiningResult> {
  const key = JSON.stringify([base, query.toLowerCase(), lat, lon]);
  const stored = cache.get(key);
  if (stored && stored.until > Date.now()) return stored.result;
  if (inFlight.has(key)) return inFlight.get(key)!;
  const task = (async () => {
    const found = await $fetch<{ food: unknown }>(
      `${base}/be/api/v2/search`,
      {
        method: "POST",
        body: {
          query,
          type: "all",
          typeRestaurant: 1,
          geolocation: `${lat}, ${lon}`,
        },
        timeout: 7000,
        retry: 0,
      },
    );
    if (
      !Array.isArray(found.food) ||
      found.food.some((id) => !Number.isSafeInteger(id) || id <= 0)
    )
      throw new Error("Invalid Delivio search");
    const allIds = [...new Set(found.food)] as number[];
    const ids = allIds.slice(0, 200);
    const chunks = Array.from({ length: Math.ceil(ids.length / 50) }, (_, i) =>
      ids.slice(i * 50, i * 50 + 50),
    );
    const responses = await Promise.all(
      chunks.map(async (chunk) => {
        const params = new URLSearchParams([
          ["itemsPerPage", "1000"],
          ["restaurant.type[]", "1"],
        ]);
        chunk.forEach((id) => params.append("id[]", String(id)));
        const data = await $fetch<Record<string, unknown>>(
          `${base}/be/api/foods?${params}`,
          { timeout: 7000, retry: 0 },
        );
        if (!Array.isArray(data["hydra:member"]))
          throw new Error("Invalid Delivio foods");
        return data["hydra:member"];
      }),
    );
    const result: DiningResult = {
      offers: delivioOffers(responses.flat(), ids),
      searchUrl: delivioSearchUrl(query),
      checkedAt: new Date().toISOString(),
      limited: allIds.length > ids.length,
    };
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(key, { result, until: Date.now() + 120000 });
    return result;
  })();
  inFlight.set(key, task);
  try {
    return await task;
  } finally {
    inFlight.delete(key);
  }
}
