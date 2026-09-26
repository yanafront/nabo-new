import { describe, it, expect } from "vitest";
import { parseRequest } from "../utils/basket";
describe("Подбор корзины", () => {
  it("собирает борщ и масштабирует упаковки", () => {
    expect(parseRequest("борщ на 5 человек")?.items).toHaveLength(8);
    expect(
      parseRequest("борщ на 10 человек")?.items.every((i) => i.quantity === 2),
    ).toBe(true);
  });
  it("находит отдельные продукты", () =>
    expect(
      parseRequest("молоко, яйца, хлеб")?.items.map((i) => i.productId),
    ).toEqual(["eggs", "milk", "bread"]));
  it("добавляет продукты к рецепту", () =>
    expect(parseRequest("борщ на 5 человек и хлеб")?.items).toHaveLength(9));
  it("не выдумывает неизвестные рецепты", () =>
    expect(parseRequest("неизвестное блюдо")).toBeNull());
});
