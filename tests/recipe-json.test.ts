import { expect, it } from "vitest";
import {
  parseRecipeJson,
  recipeJsonExample,
} from "../shared/recipe/json-editor";
const parse = (value: unknown) => parseRecipeJson(JSON.stringify(value));
it("creates a complete document without losing retail queries or quantities", () => {
  const doc = parse(recipeJsonExample);
  expect(doc.recipe.ingredients[0].searchQuery).toBe("Яйца куриные");
  expect(doc.recipe.ingredients[0].quantity).toBe(4);
  expect(doc.recipe.ingredients[0].exactUnit).toBe("10 шт");
  expect(doc.ingredients[0].searchTerms).toEqual(["Яйца куриные"]);
  expect(parse(doc)).toEqual(doc);
});
it("rejects malformed JSON and missing precise search queries", () => {
  expect(() => parseRecipeJson("{")).toThrow();
  const raw = structuredClone(recipeJsonExample) as any;
  delete raw.ingredients[0].searchQuery;
  expect(() => parse(raw)).toThrow("searchQuery");
});
it.each([
  ["slug", "../invalid"],
  ["categoryId", "unknown"],
  ["servings", 0],
])("rejects invalid %s", (key, value) => {
  expect(() => parse({ ...recipeJsonExample, [key]: value })).toThrow(key);
});
it("rejects inconsistent ingredient dictionaries and unsafe image links", () => {
  const doc = parse(recipeJsonExample);
  expect(() => parse({ ...doc, ingredients: [] })).toThrow();
  expect(() =>
    parse({ ...doc, ingredients: [...doc.ingredients, doc.ingredients[0]] }),
  ).toThrow();
  expect(() =>
    parse({ ...recipeJsonExample, image: "javascript:alert(1)" }),
  ).toThrow("image");
});
it("rejects invalid ingredient units and excessive input", () => {
  const raw = structuredClone(recipeJsonExample) as any;
  raw.ingredients[0].unit = "bad";
  expect(() => parse(raw)).toThrow("unit");
  expect(() => parseRecipeJson(" ".repeat(256 * 1024))).toThrow();
});
