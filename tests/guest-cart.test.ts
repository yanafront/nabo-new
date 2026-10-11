import { it, expect } from "vitest";
import { parseGuestCart } from "../shared/guest-cart";
const row = {
  productId: "green:milk",
  quantity: 2,
  product: {
    sourceId: "milk",
    storeId: "green",
    name: "Молоко",
    unit: "1 л",
    price: 3,
  },
};
it("restores session product details and rejects invalid references or quantities", () => {
  expect(
    parseGuestCart(JSON.stringify({ items: [row], title: "Покупки" }))?.items,
  ).toEqual([row]);
  for (const bad of [
    { ...row, quantity: 0 },
    { ...row, quantity: 100 },
    { ...row, productId: "other" },
    { ...row, product: { ...row.product, price: -3 } },
    { ...row, product: { ...row.product, storeId: "unknown" } },
  ])
    expect(parseGuestCart(JSON.stringify({ items: [bad] }))).toBeNull();
  expect(parseGuestCart("null")).toBeNull();
  expect(parseGuestCart("bad json")).toBeNull();
});
