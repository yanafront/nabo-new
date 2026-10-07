import { expect, it } from "vitest";
import { mergeRecipeDocuments } from "../shared/recipe/editor";
import { recipePurchaseRequest } from "../shared/recipe/purchasing";
import catalog from "../data/recipe-catalog.json";
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
it("scopes edited dictionaries to their recipe and retains unpublished original recipes", () => {
  const recipe = structuredClone(base.recipes[0]);
  recipe.title = "Редакция";
  const dict = base.ingredients.filter((i) =>
    recipe.ingredients.some((row) => row.ingredientId === i.id),
  );
  const result = mergeRecipeDocuments(base, [{ recipe, ingredients: dict }]);
  const edited = result.recipes.find((r) => r.slug === recipe.slug)!;
  expect(edited.title).toBe("Редакция");
  expect(edited.ingredients[0].ingredientId).toBe(
    `managed:${recipe.slug}:${recipe.ingredients[0].ingredientId}`,
  );
  expect(result.recipes.find((r) => r.slug === base.recipes[1].slug)).toEqual(
    base.recipes[1],
  );
  expect(base.recipes[0].title).not.toBe("Редакция");
});
it("keeps a published inactive override so the original recipe cannot reappear", () => {
  const recipe = { ...base.recipes[0], isActive: false };
  expect(
    mergeRecipeDocuments(base, [
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
  const scoped = mergeRecipeDocuments(base, [
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
