import { it, expect } from "vitest";
import { discoveredProducts } from "../shared/seo/products";
const product = {
  id: "sku",
  storeId: "green",
  name: "Молоко",
  unit: "1 л",
  available: true,
  price: 3,
  location: { lat: 53.9, lon: 27.5 },
  phone: "private",
};
it("extracts real product identities from search, batch and resolver shapes without prices or personal data", () => {
  const result = discoveredProducts({
    stores: [{ products: [product] }],
    items: [{ result: { products: [product] } }, { product }],
  });
  expect(result).toEqual([
    { id: "sku", storeId: "green", name: "Молоко", unit: "1 л" },
  ]);
  expect(
    discoveredProducts({ items: [{ id: "query-1", query: "Молоко" }] }),
  ).toEqual([]);
});
it("skips invalid records rather than poisoning a complete ingest batch", () => {
  const result = discoveredProducts({
    products: [
      product,
      { ...product, id: "bad", name: "x".repeat(501) },
      { ...product, storeId: "unknown" },
      {
        ...product,
        id: "optional",
        unit: "x".repeat(201),
        image: "javascript:alert(1)",
      },
    ],
  });
  expect(result).toHaveLength(2);
  expect(result[1]).toMatchObject({ id: "optional", unit: "" });
  expect(result[1].image).toBeUndefined();
});
it("retains different retailer IDs and safe optional images", () => {
  expect(
    discoveredProducts({
      products: [
        product,
        {
          ...product,
          storeId: "evroopt",
          image: "https://example.com/milk.jpg",
        },
      ],
    }),
  ).toHaveLength(2);
});
