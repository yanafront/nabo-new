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
  delete raw.recipe.ingredients[0].searchQuery;
  expect(() => parse(raw)).toThrow("searchQuery");
});
it.each([
  ["slug", "../invalid"],
  ["categoryId", "unknown"],
  ["servings", 0],
])("rejects invalid %s", (key, value) => {
  expect(() =>
    parse({
      ...recipeJsonExample,
      recipe: { ...recipeJsonExample.recipe, [key]: value },
    }),
  ).toThrow(key);
});
it("rejects inconsistent ingredient dictionaries and unsafe image links", () => {
  const doc = parse(recipeJsonExample);
  expect(() => parse({ ...doc, ingredients: [] })).toThrow();
  expect(() =>
    parse({ ...doc, ingredients: [...doc.ingredients, doc.ingredients[0]] }),
  ).toThrow();
  expect(() =>
    parse({
      ...recipeJsonExample,
      recipe: { ...recipeJsonExample.recipe, image: "javascript:alert(1)" },
    }),
  ).toThrow("image");
});
it("rejects invalid ingredient units and excessive input", () => {
  const raw = structuredClone(recipeJsonExample) as any;
  raw.recipe.ingredients[0].unit = "bad";
  expect(() => parse(raw)).toThrow("unit");
  expect(() => parseRecipeJson(" ".repeat(256 * 1024))).toThrow();
});

it("the full example retains every recipe, nutrition and dictionary field on round-trip", () => {
  expect(parse(recipeJsonExample)).toEqual({
    ...recipeJsonExample,
    recipe: {
      ...recipeJsonExample.recipe,
      id: "nabo:omlet-s-pomidorami",
      sourceId: "omlet-s-pomidorami",
    },
  });
  const { recipe } = parse(recipeJsonExample);
  expect(recipe.nutrition).toEqual(recipeJsonExample.recipe.nutrition);
  expect(recipe.yieldGrams).toBe(500);
});
it("compact input still supports all recipe fields and generates its dictionary", () => {
  const doc = parse(recipeJsonExample.recipe);
  expect(doc.recipe).toEqual({
    ...recipeJsonExample.recipe,
    id: "nabo:omlet-s-pomidorami",
    sourceId: "omlet-s-pomidorami",
  });
  expect(doc.ingredients[0].searchTerms).toEqual(["Яйца куриные"]);
});
it("requires a finished dish weight for per-100g nutrition", () => {
  const doc: any = structuredClone(recipeJsonExample);
  doc.recipe.nutrition.basis = "100g";
  delete doc.recipe.yieldGrams;
  expect(() => parse(doc)).toThrow("yieldGrams");
  doc.recipe.yieldGrams = 500;
  expect(parse(doc).recipe.nutrition?.basis).toBe("100g");
});
it.each(["calories", "protein", "fat", "carbs"])(
  "rejects invalid nutrition.%s",
  (key) => {
    const doc: any = structuredClone(recipeJsonExample);
    doc.recipe.nutrition[key] = -1;
    expect(() => parse(doc)).toThrow(`nutrition.${key}`);
  },
);
it.each(["gramsPerPiece", "gramsPerTablespoon", "density"])(
  "checks dictionary conversion %s",
  (key) => {
    const doc: any = structuredClone(recipeJsonExample);
    doc.ingredients[0][key] = -1;
    expect(() => parse(doc)).toThrow(key);
  },
);

it("keeps the data of existing catalog recipes, including all nutrition fields", async () => {
  const { default: catalog } = await import("./fixtures/recipes.json");
  for (const recipe of catalog.recipes) {
    const dictionary = catalog.ingredients.filter((i) =>
      recipe.ingredients.some((row) => row.ingredientId === i.id),
    );
    const document = {
      recipe: {
        ...recipe,
        ingredients: recipe.ingredients.map((row) => ({
          ...row,
          searchQuery:
            dictionary.find((i) => i.id === row.ingredientId)?.searchTerms[0] ||
            row.name,
        })),
      },
      ingredients: dictionary,
    };
    const result = parse(document);
    expect(result.recipe).toMatchObject(document.recipe);
    expect(result.ingredients).toEqual(dictionary);
  }
});

it("generates unique technical IDs when the full template is reused with another slug", () => {
  const doc = parse({
    ...recipeJsonExample,
    recipe: { ...recipeJsonExample.recipe, slug: "drugoy-omlet" },
  });
  expect(doc.recipe.id).toBe("nabo:drugoy-omlet");
  expect(doc.recipe.sourceId).toBe("drugoy-omlet");
});
