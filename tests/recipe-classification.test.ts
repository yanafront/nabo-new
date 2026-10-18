import { expect, it } from "vitest";
import {
  recipeCollectionChanges,
  recipeCollectionIds,
  withRecipeCollections,
} from "../shared/recipe/classification";
it("only sends explicitly toggled flags, ignoring custom tags and ordering", () => {
  expect(
    recipeCollectionChanges(
      ["custom", "easy", "quick20"],
      ["quick20", "family"],
    ),
  ).toEqual({ add: ["family"], remove: ["easy"] });
  expect(
    recipeCollectionChanges(["easy", "quick20"], ["quick20", "easy"]),
  ).toEqual({ add: [], remove: [] });
  expect(recipeCollectionIds(["custom", "family"])).toEqual(["family"]);
});
it("applies the same flag patch to distinct public/draft tags without leaking unrelated changes", () => {
  const patch = { add: ["family"], remove: ["easy"] };
  expect(
    withRecipeCollections(["public-custom", "easy", "light"], patch),
  ).toEqual(["public-custom", "light", "family"]);
  expect(withRecipeCollections(["draft-custom", "quick20"], patch)).toEqual([
    "draft-custom",
    "quick20",
    "family",
  ]);
  expect(
    withRecipeCollections(["family", "custom"], {
      add: ["family"],
      remove: [],
    }),
  ).toEqual(["custom", "family"]);
});
it("family membership follows its checkbox, not the servings count", async () => {
  const { listRecipes } = await import("../shared/recipe/search");
  const { parseRecipeJson, recipeJsonExample } =
    await import("../shared/recipe/json-editor");
  const document = parseRecipeJson(JSON.stringify(recipeJsonExample));
  const small = {
    ...document.recipe,
    slug: "small",
    servings: 2,
    tags: ["family"],
  };
  const large = { ...document.recipe, slug: "large", servings: 6, tags: [] };
  expect(
    listRecipes([small, large], document.ingredients, {
      collection: "family",
    }).recipes.map((r) => r.slug),
  ).toEqual(["small"]);
});
