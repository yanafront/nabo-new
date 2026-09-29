import { describe, expect, it } from "vitest";
import { parseDishIntent } from "../utils/intent";

describe("meal intent", () => {
  it("opens a quick collection without leaving Russian suffix fragments", () => {
    expect(parseDishIntent("быстрый ужин")).toEqual({ collection: "quick30" });
    expect(parseDishIntent("быстрый ужин с курицей")).toEqual({
      q: "с курицей",
      collection: "quick30",
    });
  });

  it("keeps the dish and passes servings", () => {
    expect(parseDishIntent("борщ на 5 человек")).toEqual({
      q: "борщ",
      servings: "5",
    });
    expect(parseDishIntent("завтраки на двоих")).toEqual({
      q: "завтраки",
      servings: "2",
    });
  });

  it("recognizes a budget request", () => {
    expect(parseDishIntent("ужин на двоих до 25 BYN")).toEqual({
      collection: "budget",
      servings: "2",
      budget: "25",
    });
  });
});
