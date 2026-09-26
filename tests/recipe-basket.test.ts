import { describe, it, expect } from "vitest";
import { recipeBasket } from "../shared/recipe-basket";
import { normalizeSearch } from "../server/utils/yandex-schema";
import fixture from "./fixtures/yandex-search.json";
const p = normalizeSearch(
  fixture,
  "gippo",
  "gippo_plqer",
  "2026-09-22T00:00:00Z",
)[0];
const line = {
  itemId: "milk",
  query: "молоко",
  quantity: 1,
  selected: p,
  alternatives: [p],
};
const offer = {
  storeId: "gippo" as const,
  placeSlug: "gippo_plqer",
  fetchedAt: p.fetchedAt,
  lines: [line],
};
describe("Реальные товары для рецепта", () => {
  it("сохраняет реальные id, название и цену источника", () => {
    expect(recipeBasket([offer])?.items[0].product).toMatchObject({
      sourceId: p.id,
      name: p.name,
      price: 2.35,
    });
  });
  it("не вставляет отсутствующий ингредиент в корзину", () => {
    const result = recipeBasket([
      {
        ...offer,
        lines: [
          line,
          {
            ...line,
            itemId: "beef",
            query: "мясо",
            selected: null,
            alternatives: [],
          },
        ],
      },
    ]);
    expect(result?.items).toHaveLength(1);
    expect(result?.missing).toEqual(["мясо"]);
  });
  it("не превращает ошибку провайдера в товар", () =>
    expect(
      recipeBasket([{ ...offer, lines: [{ ...line, error: "timeout" }] }])
        ?.items,
    ).toEqual([]));
  it("объединяет упаковки одинакового товара", () =>
    expect(
      recipeBasket([{ ...offer, lines: [line, { ...line, itemId: "second" }] }])
        ?.items[0].quantity,
    ).toBe(2));
  it("учитывает остаток при объединении", () =>
    expect(
      recipeBasket([
        {
          ...offer,
          lines: [
            { ...line, quantity: 10 },
            { ...line, itemId: "second", quantity: 10 },
          ],
        },
      ])?.missing,
    ).toEqual(["молоко"]));
  it("предпочитает более полную корзину", () => {
    const empty = {
      ...offer,
      storeId: "santa" as const,
      lines: [{ ...line, selected: null, alternatives: [] }],
    };
    expect(recipeBasket([empty, offer])?.storeId).toBe("gippo");
  });
});

it("для свежих томатов не подставляет маринованные", () => {
  const pickled = { ...p, name: "Томаты маринованные черри", id: "pickled" };
  const fresh = { ...p, name: "Томаты черри свежие", id: "fresh" };
  const result = recipeBasket([
    {
      ...offer,
      lines: [
        {
          ...line,
          itemId: "tomato",
          query: "Томаты черри",
          selected: pickled,
          alternatives: [pickled, fresh],
        },
      ],
    },
  ]);
  expect(result?.items[0].product?.sourceId).toBe("fresh");
});
