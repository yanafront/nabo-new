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
  it("не отбрасывает выбор бэкенда по локальному пересчёту остатка", () =>
    expect(
      recipeBasket([
        {
          ...offer,
          lines: [
            { ...line, quantity: 10 },
            { ...line, itemId: "second", quantity: 10 },
          ],
        },
      ])?.items[0].quantity,
    ).toBe(20));
  it("предпочитает более полную корзину", () => {
    const empty = {
      ...offer,
      storeId: "santa" as const,
      lines: [{ ...line, selected: null, alternatives: [] }],
    };
    expect(recipeBasket([empty, offer])?.storeId).toBe("gippo");
  });
});

it("не меняет выбранные бэкендом томаты на локальную альтернативу", () => {
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
  expect(result?.items[0].product?.sourceId).toBe("pickled");
});

it("does not pick an alternative when the backend selected product is unavailable", () => {
  const demand = {
    ingredientId: "milk",
    query: "молоко",
    amount: 1500,
    dimension: "volume" as const,
  };
  const alternative = {
    ...p,
    id: "large",
    unit: "1 л",
    available: true,
    stock: 10,
  };
  const result = recipeBasket([
    {
      ...offer,
      lines: [
        {
          ...line,
          demand,
          quantity: 3,
          selected: { ...p, available: false },
          alternatives: [alternative],
        },
      ],
    },
  ]);
  expect(result?.items).toEqual([]);
  expect(result?.missing).toEqual(["молоко"]);
});
it("combines equal ingredient requirements without changing input", () => {
  const requirement = {
    ingredientId: "milk",
    query: "молоко",
    amount: 500,
    dimension: "volume" as const,
  };
  const requests = [
    { productId: "milk", quantity: 1, requirement },
    { productId: "second", quantity: 1, requirement: { ...requirement } },
  ];
  const result = recipeBasket(
    [{ ...offer, lines: [line, { ...line, itemId: "second" }] }],
    requests,
  );
  expect(result?.items[0].requirement?.amount).toBe(1000);
  expect(requirement.amount).toBe(500);
});
it("preserves the backend selection even when a local ingredient filter disagrees", () => {
  const chips = { ...p, id: "chips", name: "Чипсы Лэйс Сметана-Лук 140г" };
  const cream = { ...p, id: "cream", name: "Сметана Брест-Литовск 20% 180г" };
  const result = recipeBasket([
    {
      ...offer,
      lines: [
        {
          ...line,
          query: "Сметана",
          selected: chips,
          alternatives: [chips, cream],
        },
      ],
    },
  ]);
  expect(result?.items[0].product?.sourceId).toBe("chips");
});

it("keeps backend quantity rather than inferring packs from ingredient demand", () => {
  const demand = {
    ingredientId: "milk",
    query: "молоко",
    amount: 1500,
    dimension: "volume" as const,
  };
  const result = recipeBasket([
    {
      ...offer,
      lines: [
        { ...line, quantity: 3, demand, selected: { ...p, unit: "1 л" } },
      ],
    },
  ]);
  expect(result?.items[0].quantity).toBe(3);
});
it("does not silently add an alternative when selected is null", () => {
  const result = recipeBasket([
    { ...offer, lines: [{ ...line, selected: null, alternatives: [p] }] },
  ]);
  expect(result?.items).toEqual([]);
  expect(result?.missing).toEqual(["молоко"]);
});

it("keeps backend store ordering instead of choosing the cheaper local subtotal", () => {
  const cheaper = {
    ...offer,
    storeId: "santa" as const,
    lines: [
      { ...line, selected: { ...p, storeId: "santa" as const, price: 0.01 } },
    ],
  };
  expect(recipeBasket([offer, cheaper])?.storeId).toBe("gippo");
});
