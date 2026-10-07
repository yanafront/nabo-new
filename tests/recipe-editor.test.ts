import { expect, it } from "vitest";
import { recipeCatalogFromDocuments } from "../shared/recipe/editor";
import { recipePurchaseRequest } from "../shared/recipe/purchasing";
import catalog from "./fixtures/recipes.json";
import type { RecipeCatalog } from "../shared/recipe/model";
const base = catalog as RecipeCatalog;
it("overrides the search query without changing visible ingredient names or amounts", () => {
  const recipe = structuredClone(base.recipes[0]);
  const row = recipe.ingredients[0];
  row.searchQuery = "Яйца куриные";
  row.exactName = "Яйца куриные С1 10 шт";
  const result = recipePurchaseRequest(
    recipe,
    base.ingredients,
    recipe.servings,
    [],
  );
  expect(
    result.items.some(
      (i) =>
        i.product?.name === row.searchQuery &&
        i.product?.exactName === row.exactName,
    ),
  ).toBe(true);
  expect(recipe.ingredients[0].name).toBe(base.recipes[0].ingredients[0].name);
});
it("uses only backend documents and isolates ingredient dictionaries", () => {
  const recipe = structuredClone(base.recipes[0]);
  const dict = base.ingredients.filter((i) =>
    recipe.ingredients.some((row) => row.ingredientId === i.id),
  );
  const other = { ...recipe, slug: "another-recipe" };
  const editedDict = structuredClone(dict);
  editedDict.find(
    (i) => i.id === recipe.ingredients[0].ingredientId,
  )!.searchTerms = ["Точный запрос"];
  const result = recipeCatalogFromDocuments([
    { recipe, ingredients: editedDict },
    { recipe: other, ingredients: dict },
  ]);
  expect(result.recipes).toHaveLength(2);
  expect(result.recipes.some((r) => r.slug === "syrniki")).toBe(false);
  const edited = result.recipes.find((r) => r.slug === recipe.slug)!;
  const unchanged = result.recipes.find((r) => r.slug === other.slug)!;
  expect(
    result.ingredients.find((i) => i.id === edited.ingredients[0].ingredientId)
      ?.searchTerms,
  ).toEqual(["Точный запрос"]);
  expect(
    result.ingredients.find(
      (i) => i.id === unchanged.ingredients[0].ingredientId,
    )?.searchTerms,
  ).toEqual(
    dict.find((i) => i.id === recipe.ingredients[0].ingredientId)!.searchTerms,
  );
  expect(recipe.ingredients[0].ingredientId).not.toContain("managed:");
});
it("does not invent recipes for an empty backend catalog", () => {
  expect(recipeCatalogFromDocuments([])).toEqual({
    version: 2,
    recipes: [],
    ingredients: [],
  });
});
it("keeps a published inactive override so the original recipe cannot reappear", () => {
  const recipe = { ...base.recipes[0], isActive: false };
  expect(
    recipeCatalogFromDocuments([
      { recipe, ingredients: base.ingredients },
    ]).recipes.find((r) => r.slug === recipe.slug)?.isActive,
  ).toBe(false);
});

it("keeps request IDs below the backend limit for long slugs and exact product names", () => {
  const recipe = structuredClone(base.recipes[0]);
  recipe.slug = "a".repeat(100);
  recipe.ingredients[0].searchQuery = "x".repeat(160);
  recipe.ingredients[0].exactName = "y".repeat(500);
  recipe.ingredients[0].exactUnit = "10 шт";
  const scoped = recipeCatalogFromDocuments([
    { recipe, ingredients: base.ingredients },
  ]);
  const r = scoped.recipes.find((r) => r.slug === recipe.slug)!;
  const request = recipePurchaseRequest(r, scoped.ingredients, r.servings, []);
  expect(request.items.every((row) => row.productId.length <= 150)).toBe(true);
  expect(new Set(request.items.map((row) => row.productId)).size).toBe(
    request.items.length,
  );
  expect(
    request.items.some(
      (row) =>
        row.product?.exactName === "y".repeat(500) &&
        row.product?.unit === "10 шт",
    ),
  ).toBe(true);
});
