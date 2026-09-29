import { describe, it, expect } from "vitest";
import { parseRequest } from "../utils/basket";
describe("Product lists", () => {
  it("keeps explicit product lists", () =>
    expect(
      parseRequest("молоко, яйца, хлеб")?.items.map((i) => i.productId),
    ).toEqual(["eggs", "milk", "bread"]));
  it("does not assemble hardcoded recipes anymore", () =>
    expect(parseRequest("борщ на 4 человека")).toBeNull());
  it("does not invent unknown products", () =>
    expect(parseRequest("неизвестное блюдо")).toBeNull());
});
