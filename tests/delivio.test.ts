import { expect, it, vi, afterEach } from "vitest";
import { delivioOffers, delivioImage } from "../shared/dining/delivio";
import { searchDelivio } from "../server/utils/delivio";
const food = (id: number, price: number, open = true) => ({
  id,
  name: "Сырники",
  price,
  enabled: true,
  isOpen: open,
  isAvailableAtRestaurantSchedule: true,
  showWeight: true,
  weight: 180,
  weightUnitStr: "г",
  restaurant: { id: 10, name: "Кафе", slug: "cafe", type: 1, isOpened: open },
});
afterEach(() => vi.unstubAllGlobals());
it("keeps restaurant prices and portions, filters unrelated ids, shops and invalid offers", () => {
  const rows = [
    food(1, 9),
    food(2, 5, false),
    food(3, 15),
    food(1, 9),
    food(4, 1),
    { ...food(5, 1), restaurant: { ...food(5, 1).restaurant, type: 2 } },
    { ...food(6, 1), enabled: false },
    food(7, -1),
    { ...food(8, 1), soldByPoints: true },
  ];
  const offers = delivioOffers(rows, [1, 2, 3, 5, 6, 7, 8]);
  expect(offers.map((o) => o.price)).toEqual([9, 15, 5]);
  expect(offers[0].portion).toBe("180 г");
  expect(offers[0].url).toBe("https://delivio.by/restaurant/cafe");
  expect(offers[2].available).toBe(false);
});
it("uses actual two-step search, sends only title and coordinates, and coalesces/cache requests", async () => {
  const fetch = vi.fn(async (url: string, options?: any) =>
    url.endsWith("/search")
      ? { food: [1, 2] }
      : { "hydra:member": [food(1, 9), food(2, 12)] },
  );
  vi.stubGlobal("$fetch", fetch);
  const [a, b] = await Promise.all([
    searchDelivio("сырники-тест", 53.9, 27.5667),
    searchDelivio("сырники-тест", 53.9, 27.5667),
  ]);
  expect(a).toEqual(b);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[0][1]).toMatchObject({
    method: "POST",
    body: {
      query: "сырники-тест",
      type: "all",
      typeRestaurant: 1,
      geolocation: "53.9, 27.5667",
    },
  });
  expect(new URL(fetch.mock.calls[1][0]).searchParams.getAll("id[]")).toEqual([
    "1",
    "2",
  ]);
  await searchDelivio("сырники-тест", 53.9, 27.5667);
  expect(fetch).toHaveBeenCalledTimes(2);
  await searchDelivio("сырники-тест", 53.91, 27.57);
  expect(fetch).toHaveBeenCalledTimes(4);
});
it("empty search never loads arbitrary foods", async () => {
  const fetch = vi.fn(async () => ({ food: [] }));
  vi.stubGlobal("$fetch", fetch);
  expect((await searchDelivio("нет-блюда", 53.9, 27.5)).offers).toEqual([]);
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("rejects unexpected source format without caching a failure", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({ food: "bad" })
    .mockResolvedValueOnce({ food: [] });
  vi.stubGlobal("$fetch", fetch);
  await expect(searchDelivio("неверный-ответ", 53.9, 27.5)).rejects.toThrow();
  expect((await searchDelivio("неверный-ответ", 53.9, 27.5)).offers).toEqual(
    [],
  );
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("uses Delivio photos only and prefers a card-sized source image", () => {
  expect(delivioImage("/uploads/img/food/photo.jpg")).toBe(
    "https://cdn.delivio.by/uploads/img/food/photo.jpg",
  );
  expect(delivioImage("https://cdn.delivio.by/photo.jpg")).toBe(
    "https://cdn.delivio.by/photo.jpg",
  );
  for (const value of [
    null,
    "",
    "javascript:alert(1)",
    "https://example.com/photo.jpg",
    "//evil.test/photo.jpg",
    "http://delivio.by/photo.jpg",
  ])
    expect(delivioImage(value)).toBeUndefined();
  expect(
    delivioOffers(
      [{ ...food(1, 9), pictureSmall: "/small.jpg", picture: "/full.jpg" }],
      [1],
    )[0].image,
  ).toBe("https://cdn.delivio.by/small.jpg");
});
