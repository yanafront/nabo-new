import { describe, it, expect } from "vitest";
import { summarizeComparison } from "../shared/comparison";
import { normalizeSearch } from "../server/utils/yandex-schema";
import fixture from "./fixtures/yandex-search.json";
const product = normalizeSearch(
  fixture,
  "gippo",
  "gippo_plqer",
  "2026-09-21T18:00:00Z",
)[0];
const line = {
  itemId: "milk",
  query: "молоко",
  quantity: 2,
  selected: product,
  alternatives: [product],
};
const offer = {
  storeId: "gippo" as const,
  placeSlug: "gippo_plqer",
  lines: [line],
  fetchedAt: product.fetchedAt,
};
describe("Итоги живой корзины", () => {
  it("умножает точную цену на количество", () =>
    expect(summarizeComparison(offer)).toMatchObject({
      subtotal: 4.7,
      complete: true,
    }));
  it("не объявляет неполную корзину полной", () =>
    expect(
      summarizeComparison({ ...offer, lines: [{ ...line, selected: null }] })
        .complete,
    ).toBe(false));
  it("учитывает общий остаток при повторяющемся SKU", () => {
    const lines = [
      { ...line, quantity: 8 },
      { ...line, itemId: "milk2", quantity: 8 },
    ];
    expect(summarizeComparison({ ...offer, lines }).stockProblems).toHaveLength(
      2,
    );
    expect(summarizeComparison({ ...offer, lines }).complete).toBe(false);
  });
  it("ошибка источника исключает предложение из полных", () =>
    expect(
      summarizeComparison({ ...offer, lines: [{ ...line, error: "timeout" }] })
        .complete,
    ).toBe(false));
});
