import { describe, it, expect } from "vitest";
import { recommend, withPreferences } from "../shared/recommendation";
import { summarizeComparison } from "../shared/comparison";
import type { RetailProduct, StoreComparison, StoreId } from "../shared/yandex";
import type { Item } from "../data/catalog";
function offer(
  storeId: StoreId,
  prices: Array<number | null>,
): StoreComparison {
  return {
    storeId,
    placeSlug: storeId,
    fetchedAt: new Date().toISOString(),
    lines: prices.map((price, i) => {
      const product: RetailProduct = {
        id: `p${i}`,
        storeId,
        placeSlug: storeId,
        name: `Товар ${i}`,
        unit: "1 кг",
        price: price || 1,
        oldPrice: null,
        image: null,
        stock: 10,
        available: true,
        fetchedAt: new Date().toISOString(),
      };
      return {
        itemId: `i${i}`,
        query: product.name,
        quantity: 1,
        selected: price === null ? null : product,
        alternatives: [product],
      };
    }),
  };
}
describe("Честная рекомендация магазина", () => {
  it("не рекомендует дешёвую неполную корзину вместо полной", () => {
    const result = recommend([
      offer("sosedi", [1, null]),
      offer("green", [4, 6]),
      offer("santa", [5, 8]),
    ]);
    expect(result.best?.storeId).toBe("green");
    expect(result.saving).toBe(3);
    expect(result.baseline).toBe("santa");
  });
  it("не выдумывает экономию без второй полной корзины", () => {
    expect(
      recommend([offer("green", [4]), offer("santa", [null])]).saving,
    ).toBe(0);
    expect(recommend([offer("green", [null])]).best).toBeNull();
  });
  it("сравнивает экономию только при одинаковом количестве товаров", () => {
    const other = offer("santa", [8]);
    other.lines[0].quantity = 2;
    expect(recommend([offer("green", [4]), other]).saving).toBe(0);
  });
  it("считает разделение только с полным покрытием", () => {
    const result = recommend([offer("green", [2, 8]), offer("santa", [6, 3])]);
    expect(result.split?.subtotal).toBe(5);
    expect(result.split?.saving).toBe(4);
    expect(result.split?.groups.flatMap((g) => g.lines)).toHaveLength(2);
    expect(
      recommend([offer("green", [2, null]), offer("santa", [3, null])]).split,
    ).toBeNull();
  });
  it("проверяет общий остаток повторяющегося SKU при разделении", () => {
    const a = offer("green", [2, 2, null]);
    const b = offer("santa", [10, 10, 3]);
    a.lines[0].selected!.id = "same";
    a.lines[1].selected!.id = "same";
    a.lines[0].selected!.stock = 1;
    a.lines[1].selected!.stock = 1;
    expect(recommend([a, b]).split).toBeNull();
  });
  it("не считает недоступный товар признаком полной корзины", () => {
    const a = offer("green", [2]);
    a.lines[0].selected!.available = false;
    expect(summarizeComparison(a).complete).toBe(false);
    expect(recommend([a]).best).toBeNull();
  });
  it("исключает другой бренд и упаковку при запрете замены, не меняя исходные данные", () => {
    const a = offer("green", [2]);
    const item = {
      productId: "i0",
      quantity: 1,
      allowReplacement: false,
      product: { name: "Другой бренд", unit: "1 кг" },
    } as Item;
    expect(withPreferences(a, [item]).lines[0].selected).toBeNull();
    expect(a.lines[0].selected).not.toBeNull();
    item.product!.name = "Товар 0";
    item.product!.unit = "2 кг";
    expect(withPreferences(a, [item]).lines[0].alternatives).toHaveLength(0);
    item.product!.unit = "1 кг";
    expect(withPreferences(a, [item]).lines[0].selected).not.toBeNull();
  });
});
