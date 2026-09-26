import { describe, expect, it } from "vitest";
import { presentRecipe, searchRecipes } from "../server/utils/recipes";

const recipe = {
  slug: "draniki",
  country: "BY",
  name: { ru: "Драники", en: "Draniki" },
  summary: { ru: "Картофельные оладьи", en: "Potato pancakes" },
  baseServings: 2,
  prepMinutes: 15,
  cookMinutes: 20,
  ingredients: [
    {
      id: "potato",
      name: { ru: "Картофель", en: "Potato" },
      quantity: 500,
      unit: "g",
      scaling: "linear" as const,
    },
    {
      id: "salt",
      name: { ru: "Соль", en: "Salt" },
      quantity: 1,
      unit: "tsp",
      scaling: "fixed" as const,
    },
  ],
  photo: null,
};

describe("поиск рецептов", () => {
  it("находит блюдо по русскому названию и словам запроса", () => {
    const unrelated = {
      ...recipe,
      slug: "stew",
      name: { ru: "Рагу", en: "Stew" },
      summary: { ru: "Блюдо на обед", en: "Lunch" },
    };
    expect(searchRecipes([unrelated, recipe], "приготовить драники на 4 человека")).toEqual([
      recipe,
    ]);
  });

  it("масштабирует продукты под число порций и исключает базовые специи", () => {
    expect(presentRecipe(recipe, 4)).toMatchObject({
      servings: 4,
      minutes: 35,
      ingredients: [{ name: "Картофель", amount: "1000 г" }],
    });
  });
});
