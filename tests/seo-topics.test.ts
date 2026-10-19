import { expect, it } from "vitest";
import {
  productTopic,
  ingredientTopic,
  recipeTopic,
  relatedRecipes,
} from "../shared/seo/topics";
import catalog from "./fixtures/recipes.json";
import type { Recipe } from "../shared/recipe/model";
it("only finite editorial product and recipe topics create landing pages", () => {
  expect(productTopic("moloko")?.name).toBe("Молоко");
  expect(productTopic("anything-new")).toBeUndefined();
  expect(recipeTopic("high-protein")).toHaveProperty("collection", "protein");
  expect(ingredientTopic("Молоко 3,2 %")?.slug).toBe("moloko");
  expect(ingredientTopic("Вода")).toBeUndefined();
});
it("related recipes exclude the current recipe and require a shared ingredient or category", () => {
  const recipe = catalog.recipes[0] as Recipe;
  const found = relatedRecipes(recipe, catalog.recipes as Recipe[]);
  expect(found.length).toBeLessThanOrEqual(3);
  expect(found.every((r) => r.slug !== recipe.slug)).toBe(true);
});
