import { afterEach, expect, it, vi } from "vitest";
import { createError, type H3Event } from "h3";
import { publishedRecipes } from "../server/utils/published-recipes";
import fixture from "./fixtures/recipes.json";
const event = {} as H3Event;
afterEach(() => vi.unstubAllGlobals());
function setup(base = "https://recipes.test") {
  vi.stubGlobal("useRuntimeConfig", () => ({ recipesApiBase: base }));
  vi.stubGlobal("createError", createError);
}
it("uses the recipe service and never adds local recipes to its response", async () => {
  setup();
  const recipe = fixture.recipes[0];
  const fetch = vi.fn(async () => ({
    documents: [{ recipe, ingredients: fixture.ingredients }],
  }));
  vi.stubGlobal("$fetch", fetch);
  const result = await publishedRecipes(event);
  expect(fetch.mock.calls[0]).toEqual([
    "https://recipes.test/api/recipe-catalog",
    { timeout: 15000, retry: 0 },
  ]);
  expect(result.recipes.map((r) => r.slug)).toEqual([recipe.slug]);
});
it("preserves an empty backend catalog", async () => {
  setup();
  vi.stubGlobal(
    "$fetch",
    vi.fn(async () => ({ documents: [] })),
  );
  expect((await publishedRecipes(event)).recipes).toEqual([]);
});
it("reports missing configuration without falling back to bundled data", async () => {
  setup("");
  await expect(publishedRecipes(event)).rejects.toMatchObject({
    statusCode: 503,
  });
});
it("reports backend outages without restoring removed recipes", async () => {
  setup();
  vi.stubGlobal(
    "$fetch",
    vi.fn(async () => {
      throw new Error("unavailable");
    }),
  );
  await expect(publishedRecipes(event)).rejects.toMatchObject({
    statusCode: 502,
  });
});
it("rejects an unexpected backend response", async () => {
  setup();
  vi.stubGlobal(
    "$fetch",
    vi.fn(async () => ({})),
  );
  await expect(publishedRecipes(event)).rejects.toMatchObject({
    statusCode: 502,
  });
});
