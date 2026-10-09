import { expect, it } from "vitest";
import {
  summarizeStoreBasket,
  cheapestCompleteBasket,
} from "../shared/store-baskets";
import type { StoreComparison, RetailProduct, StoreId } from "../shared/yandex";
const product = (storeId: StoreId, price: number): RetailProduct => ({
  id: "sku",
  storeId,
  name: "Молоко",
  unit: "1 л",
  price,
  available: true,
  stock: null,
  oldPrice: null,
  image: null,
  placeSlug: storeId,
  fetchedAt: "2026-10-09",
});
const offer = (
  storeId: StoreId,
  prices: Array<number | null>,
): StoreComparison => ({
  storeId,
  placeSlug: storeId,
  fetchedAt: "2026-10-09",
  lines: prices.map((price, index) => ({
    itemId: `item-${index}`,
    query: "Молоко",
    quantity: 1,
    selected: price === null ? null : product(storeId, price),
    alternatives: [],
  })),
});
it("does not recommend a cheap partial basket over a complete basket", () => {
  const best = cheapestCompleteBasket(
    [
      offer("green", [1, null]),
      offer("sosedi", [3, 4]),
      offer("evroopt", [2, 4]),
    ],
    ["item-0", "item-1"],
  );
  expect(best?.storeId).toBe("evroopt");
  expect(best?.subtotal).toBe(6);
});
it("does not label a response with omitted lines as a complete basket", () => {
  expect(
    summarizeStoreBasket(offer("green", [1]), ["item-0", "item-1"]),
  ).toMatchObject({ complete: false, found: 1, subtotal: 1 });
});
it("does not rank baskets without sufficient stock or with retailer errors", () => {
  const first = offer("green", [1]);
  first.lines[0].selected!.stock = 0;
  const second = offer("sosedi", [1]);
  second.lines[0].error = "timeout";
  expect(cheapestCompleteBasket([first, second], ["item-0"])).toBeNull();
});
it("does not include another chain or a nonfinite price in the selected store total", () => {
  const wrongStore = offer("green", [2]);
  wrongStore.lines[0].selected!.storeId = "sosedi";
  expect(summarizeStoreBasket(wrongStore, ["item-0"])).toMatchObject({
    complete: false,
    found: 0,
    hasPrice: false,
    subtotal: 0,
  });
  const invalid = offer("green", [NaN]);
  expect(summarizeStoreBasket(invalid, ["item-0"]).hasPrice).toBe(false);
});
it("does not invent a best store when every basket is incomplete", () => {
  expect(
    cheapestCompleteBasket(
      [offer("green", [null]), offer("evroopt", [null])],
      ["item-0"],
    ),
  ).toBeNull();
});
