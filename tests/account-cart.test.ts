import { describe, expect, it } from "vitest";
import {
  accountCartItems,
  refreshedItem,
  restoredCartItems,
} from "../shared/account-cart";
import type { Item } from "../data/catalog";
import type { ProductResult } from "../shared/yandex";
const row: Item = {
  productId: "green:12",
  quantity: 3,
  requirement: {
    ingredientId: "milk",
    query: "Молоко",
    amount: 500,
    dimension: "volume",
  },
  product: {
    id: "green:12",
    sourceId: "12",
    storeId: "green",
    name: "Молоко",
    unit: "1 л",
    price: 2,
    brand: "",
    emoji: "",
    keywords: [],
  },
};
const fresh: ProductResult = {
  storeId: "green",
  id: "12",
  status: "ok",
  fetchedAt: "2026-10-02",
  product: {
    id: "12",
    storeId: "green",
    name: "Молоко",
    unit: "1 л",
    price: 3,
    image: null,
    oldPrice: null,
    placeSlug: "green",
    available: true,
    stock: 2,
    fetchedAt: "2026-10-02",
  },
};
describe("account basket", () => {
  it("saves source IDs and quantities without prices or recipe internals", () => {
    expect(accountCartItems([row])).toEqual([
      {
        id: "12",
        storeId: "green",
        name: "Молоко",
        count: 3,
        unit: "1 л",
        image: null,
      },
    ]);
  });
  it("refreshes exact products while preserving quantities and recipe demand", () => {
    const result = refreshedItem(row, fresh);
    expect(result.product?.price).toBe(3);
    expect(result.quantity).toBe(3);
    expect(result.requirement).toEqual(row.requirement);
    expect(row.product?.price).toBe(2);
    const mismatched = refreshedItem(row, { ...fresh, storeId: "sosedi" });
    expect(mismatched.product?.price).toBeNull();
    expect(mismatched.product?.storeId).toBe("green");
    expect(mismatched.product?.refreshStatus).toBe("error");
  });
  it("does not retain stale prices when the backend omits an item", () => {
    const result = refreshedItem(row);
    expect(result.product?.price).toBeNull();
    expect(result.product?.refreshStatus).toBe("error");
    expect(result.quantity).toBe(3);
    expect(result.product?.sourceId).toBe("12");
    expect(row.product?.price).toBe(2);
  });
  it("does not substitute a different product returned with the same response ID", () => {
    const result = refreshedItem(row, {
      ...fresh,
      product: { ...fresh.product!, id: "other", name: "Другой товар" },
    });
    expect(result.product?.price).toBeNull();
    expect(result.product?.sourceId).toBe("12");
    expect(result.product?.name).toBe("Молоко");
    expect(result.quantity).toBe(3);
  });
  it("restores an unconfirmed saved item without inventing its price", () => {
    const restored = restoredCartItems([
      { id: "12", storeId: "green", name: "Молоко", count: 3 },
    ]);
    expect(restored[0].product?.price).toBeNull();
    expect(restored[0].product?.refreshStatus).toBe("error");
    expect(restored[0].quantity).toBe(3);
  });
  it("does not include failed, missing or unavailable products in the total", () => {
    for (const status of ["not_found", "error"] as const) {
      const result = refreshedItem(row, { ...fresh, status, product: null });
      expect(result.product?.price).toBeNull();
      expect(result.product?.name).toBe("Молоко");
      expect(result.product?.refreshStatus).toBe(status);
    }
    expect(
      refreshedItem(row, {
        ...fresh,
        product: { ...fresh.product!, available: false },
      }).product?.price,
    ).toBeNull();
  });
  it("restores unavailable saved positions without losing names, images or counts", () => {
    const restored = restoredCartItems([
      {
        id: "12",
        storeId: "green",
        name: "Молоко",
        count: 3,
        unit: "1 л",
        image: "https://example.org/milk.jpg",
        current: { ...fresh, status: "not_found", product: null },
      },
    ]);
    expect(restored[0].quantity).toBe(3);
    expect(restored[0].productId).toBe("green:12");
    expect(restored[0].product?.price).toBeNull();
    expect(restored[0].product?.image).toBe("https://example.org/milk.jpg");
  });
});
