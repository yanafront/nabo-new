export interface DiningOffer {
  id: string;
  name: string;
  restaurant: string;
  price: number;
  portion: string;
  url: string;
  available: boolean;
}
export interface DiningResult {
  offers: DiningOffer[];
  searchUrl: string;
  checkedAt: string;
  limited: boolean;
}
export function delivioSearchUrl(query: string) {
  return `https://delivio.by/search?type=1&q=${encodeURIComponent(query)}`;
}
export function delivioOffers(rows: unknown, ids: number[]): DiningOffer[] {
  if (!Array.isArray(rows)) throw new Error("Invalid Delivio foods");
  const allowed = new Set(ids),
    seen = new Set<string>();
  return rows
    .flatMap((food): DiningOffer[] => {
      const restaurant = food?.restaurant;
      if (
        !food ||
        !allowed.has(food.id) ||
        food.enabled !== true ||
        restaurant?.type !== 1 ||
        typeof food.name !== "string" ||
        typeof restaurant.name !== "string" ||
        typeof restaurant.slug !== "string" ||
        !/^[a-z0-9_-]+$/i.test(restaurant.slug) ||
        typeof food.price !== "number" ||
        !Number.isFinite(food.price) ||
        food.price <= 0 ||
        food.soldByPoints
      )
        return [];
      const id = `${restaurant.id}:${food.id}`;
      if (seen.has(id)) return [];
      seen.add(id);
      return [
        {
          id,
          name: food.name,
          restaurant: restaurant.name,
          price: food.price,
          portion:
            food.showWeight &&
            Number.isFinite(food.weight) &&
            food.weight > 0 &&
            typeof food.weightUnitStr === "string"
              ? `${food.weight} ${food.weightUnitStr}`
              : "",
          available:
            food.isOpen === true &&
            restaurant.isOpened === true &&
            food.isAvailableAtRestaurantSchedule !== false &&
            food.isBreak !== true,
          url: `https://delivio.by/restaurant/${encodeURIComponent(restaurant.slug)}`,
        },
      ];
    })
    .sort(
      (a, b) =>
        Number(b.available) - Number(a.available) ||
        a.price - b.price ||
        a.name.localeCompare(b.name, "ru"),
    );
}
