import { describe, it, expect } from "vitest";
import fixture from "./fixtures/yandex-search.json";
import {
  normalizeSearch,
  replacementQuery,
  selectBasketCandidates,
  selectCandidates,
  packKey,
} from "../server/utils/yandex-schema";
const normalize = (data: unknown = fixture) =>
  normalizeSearch(data, "gippo", "gippo_plqer", "2026-09-21T18:00:00Z");
describe("Проверенный ответ Яндекс Еды", () => {
  it("использует точную decimalPrice вместо усечённой price", () =>
    expect(normalize()[0].price).toBe(2.35));
  it("сохраняет упаковку, остаток и идентификатор", () => {
    const p = normalize()[0];
    expect(p.unit).toBe("1 л");
    expect(p.stock).toBe(12);
    expect(p.id).toBe("75746530-5122-46e0-bc15-09320dadd436");
  });
  it("учитывает decimalPromoPrice", () => {
    const d = structuredClone(fixture);
    (d.blocks[0].payload.products[0] as any).decimalPromoPrice = "1.99";
    expect(normalize(d)[0]).toMatchObject({ price: 1.99, oldPrice: 2.35 });
  });
  it("не подставляет усечённую цену при сломанном ответе", () => {
    const d = structuredClone(fixture);
    d.blocks[0].payload.products.forEach(
      (p) => ((p as any).decimalPrice = null),
    );
    expect(() => normalize(d)).toThrow("INVALID_RESPONSE");
  });
  it("не показывает RUB как BYN и не маскирует сломанный ответ под пустой", () => {
    expect(() =>
      normalize({ ...fixture, currency: { code: "RUB" } }),
    ).toThrow();
    expect(() =>
      normalize({ currency: { code: "BYN" }, blocks: [{ type: "unknown" }] }),
    ).toThrow();
  });
  it("отличает пустой поиск от ошибки", () =>
    expect(
      normalize({
        ...fixture,
        blocks: [{ type: "categories_products", payload: { products: [] } }],
      }),
    ).toEqual([]));
  it("исключает недоступное и недостаточный остаток", () => {
    const p = normalize();
    expect(
      selectCandidates([{ ...p[0], available: false }], "молоко", 1).selected,
    ).toBeNull();
    expect(selectCandidates(p, "молоко", 99).selected).toBeNull();
  });
  it("не подменяет точный товар другой упаковкой", () => {
    const p = normalize();
    expect(
      selectCandidates(p, "молоко", 1, p[0].name, "900 мл").selected,
    ).toBeNull();
    expect(
      selectCandidates(p, "молоко", 1, p[0].name, p[0].unit).selected?.id,
    ).toBe(p[0].id);
  });
  it("не выбирает нерелевантный первый результат", () => {
    const p = normalize();
    expect(selectCandidates(p, "хлеб", 1).selected).toBeNull();
  });
});

describe("Упаковки", () => {
  it("сопоставляет кг и г, л и мл, но не массу и объём", () => {
    expect(packKey("1 кг")).toBe(packKey("1000 г"));
    expect(packKey("1 л")).toBe(packKey("1000 мл"));
    expect(packKey("1 л")).not.toBe(packKey("1 кг"));
  });
  it("не выбирает 200 мл вместо литра", () => {
    const p = normalize()[0];
    const small = { ...p, id: "small", unit: "200 мл", name: "Молоко 200 мл" };
    expect(
      selectCandidates([small, p], "молоко", 1, undefined, "1 л").selected?.id,
    ).toBe(p.id);
  });
  it("возвращает пустой список на проверенный пустой ответ blocks=[]", () =>
    expect(normalize({ currency: { code: "BYN" }, blocks: [] })).toEqual([]));
});

describe("Корректность выбора жирности", () => {
  it("не путает 2% и 3,2%", () => {
    const p = normalize()[0];
    expect(
      selectCandidates([{ ...p, name: "Молоко 2%" }], "молоко 3,2%", 1)
        .selected,
    ).toBeNull();
    expect(
      selectCandidates([{ ...p, name: "Молоко 3.2%" }], "молоко 3,2%", 1)
        .selected,
    ).not.toBeNull();
  });
});

describe("Корзины с заменами", () => {
  it("снимает ограничение бренда при поиске знакомой категории", () => {
    expect(replacementQuery("Молоко Савушкин 3,2% 1 л")).toBe("молоко");
    expect(replacementQuery("Неизвестный продукт")).toBe("Неизвестный продукт");
  });
  it("предпочитает исходный товар, затем замену с такой же упаковкой", () => {
    const p = normalize()[0];
    const other = { ...p, id: "other", name: "Молоко другой марки" };
    const small = { ...other, id: "small", unit: "200 мл" };
    expect(selectBasketCandidates([other, p], "молоко", 1, p.name, p.unit)).toMatchObject({ selected: { id: p.id }, replacement: false });
    expect(selectBasketCandidates([small, other], "молоко", 1, p.name, p.unit)).toMatchObject({ selected: { id: "other" }, replacement: true });
  });
  it("не добавляет недоступные или нерелевантные замены", () => {
    const p = normalize()[0];
    expect(selectBasketCandidates([{ ...p, available: false }], "молоко", 1, "Молоко", "1 л").selected).toBeNull();
    expect(selectBasketCandidates([p], "хлеб", 1, "Хлеб", "500 г").selected).toBeNull();
  });
});
