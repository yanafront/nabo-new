import { describe, expect, it } from "vitest";
import { recipeStorePrice } from "../shared/recipe-store-price";
import type { Item } from "../data/catalog";
import type { SearchResult } from "../shared/yandex";
const request = (amount = 500): Item => ({
  productId: "curd",
  quantity: 1,
  product: {
    id: "curd",
    name: "Творог",
    unit: "",
    price: null,
    brand: "",
    emoji: "",
    keywords: [],
  },
  requirement: {
    ingredientId: "curd",
    query: "Творог",
    amount,
    dimension: "mass",
  },
});
const result: SearchResult = {
  storeId: "evroopt",
  placeSlug: "evroopt",
  status: "ok",
  fetchedAt: "",
  currency: "BYN",
  products: [
    {
      id: "123",
      storeId: "evroopt",
      placeSlug: "evroopt",
      name: "Творог 5%",
      unit: "200 г",
      price: 3.29,
      oldPrice: null,
      image: null,
      stock: null,
      available: true,
      fetchedAt: "",
    },
  ],
};
describe("recipe store price", () => {
  it("prices whole packages and recalculates servings from the same search results", () => {
    expect(recipeStorePrice([request()], { Творог: result })).toMatchObject({
      total: 9.87,
      complete: true,
    });
    expect(recipeStorePrice([request(1000)], { Творог: result }).total).toBe(
      16.45,
    );
  });
  it("marks a subtotal incomplete when ingredients or searches are missing", () => {
    const another = {
      ...request(),
      productId: "sugar",
      product: { ...request().product!, name: "Сахар" },
      requirement: undefined,
    };
    expect(
      recipeStorePrice([request(), another], { Творог: result }),
    ).toMatchObject({
      total: 9.87,
      complete: false,
      matched: 1,
      missing: ["Сахар"],
    });
    expect(
      recipeStorePrice([request()], { Творог: { ...result, status: "error" } })
        .items,
    ).toHaveLength(0);
  });
  it("falls back to returned search results and rejects unavailable or invalid prices", () => {
    const exact = request();
    exact.product!.exactName = "Творог другой";
    expect(recipeStorePrice([exact], { Творог: result }).items).toHaveLength(1);
    for (const changed of [
      { available: false },
      { price: NaN },
      { price: -1 },
      { storeId: "green" as const },
    ]) {
      expect(
        recipeStorePrice([request()], {
          Творог: {
            ...result,
            products: [{ ...result.products[0]!, ...changed }],
          },
        }).items,
      ).toHaveLength(0);
    }
  });
  it("prefers an exact available match even when it is not the first result", () => {
    const exact = request(200);
    exact.product!.exactName = "Творог другой";
    const selected = recipeStorePrice([exact], {
      Творог: {
        ...result,
        products: [
          result.products[0]!,
          {
            ...result.products[0]!,
            id: "exact",
            name: "Творог другой",
            price: 4,
          },
        ],
      },
    });
    expect(selected.items[0]!.product!.sourceId).toBe("exact");
    expect(selected.total).toBe(4);
  });
  it("sums quantities for duplicate selected products instead of overwriting demand", () => {
    expect(
      recipeStorePrice(
        [request(200), { ...request(400), productId: "curd2" }],
        { Творог: result },
      ),
    ).toMatchObject({ total: 9.87, items: [{ quantity: 3 }], matched: 2 });
  });
  it("does not price an insufficient stock as a complete ingredient", () => {
    expect(
      recipeStorePrice([request()], {
        Творог: { ...result, products: [{ ...result.products[0]!, stock: 1 }] },
      }),
    ).toMatchObject({ complete: false, matched: 0, total: 0 });
  });
  it("uses one package for amounts without a measurable demand", () => {
    expect(
      recipeStorePrice([{ ...request(), requirement: undefined }], {
        Творог: result,
      }).total,
    ).toBe(3.29);
    expect(recipeStorePrice([], {}).complete).toBe(false);
  });
});
