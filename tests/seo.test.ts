import { describe, it, expect } from "vitest";
import {
  seoPolicy,
  siteOrigin,
  jsonLd,
  sitemapUrls,
  productPath,
  recipeSchema,
} from "../shared/seo/core";
import type { Recipe } from "../shared/recipe/model";
describe("SEO architecture", () => {
  it("canonicalises product names and campaign parameters without trusting request hosts", () => {
    expect(siteOrigin("https://nabo.example/base")).toBe(
      "https://nabo.example",
    );
    expect(
      seoPolicy("/product/evroopt/123", { name: "Молоко", utm_source: "blog" }),
    ).toEqual({ index: true, canonicalPath: "/product/evroopt/123" });
  });
  it("keeps paginated catalogues separate from their first page", () => {
    expect(seoPolicy("/recipes/category/soups", { page: "2" })).toEqual({
      index: true,
      canonicalPath: "/recipes/category/soups?page=2",
    });
    expect(seoPolicy("/recipes", { page: "-1" }).index).toBe(false);
  });
  it("excludes all personal pages and filtered search combinations", () => {
    for (const path of [
      "/basket",
      "/saved",
      "/account",
      "/admin/recipes",
      "/l/example",
    ])
      expect(seoPolicy(path).index).toBe(false);
    expect(seoPolicy("/products", { q: "молоко", store: "green" }).index).toBe(
      false,
    );
    expect(
      seoPolicy("/recipes/category/soups", { collection: "budget" }).index,
    ).toBe(false);
  });
  it("escapes untrusted recipe text in JSON-LD", () => {
    const value = { name: "</script><script>alert(1)</script>" };
    expect(jsonLd(value)).not.toContain("</script>");
    expect(JSON.parse(jsonLd(value))).toEqual(value);
  });
  it("escapes XML and does not invent last modification dates", () => {
    const xml = sitemapUrls([
      {
        loc: "https://nabo.example/products?page=2&a=b",
        image: "https://example.com/photo?a=b&c=d",
      },
    ]);
    expect(xml).toContain("&amp;");
    expect(xml).not.toContain("<lastmod>");
    expect(xml).toContain("image:image");
  });
  it("encodes SKU paths safely", () =>
    expect(productPath("green", "a/b?x")).toBe("/product/green/a%2Fb%3Fx"));
  it("marks only actual recipe data and measurable serving nutrition", () => {
    const recipe = {
      slug: "test",
      title: "Тест",
      servings: 2,
      categoryId: "soups",
      cookingTime: 30,
      ingredients: [{ name: "Мука", quantity: 100, unit: "g" }],
      instructions: [{ text: "Смешать" }],
    } as Recipe;
    const result = recipeSchema(recipe, "https://nabo.example");
    expect(result.totalTime).toBe("PT30M");
    expect(result.recipeInstructions?.[0].url).toMatch(/#step-1$/);
    expect(result).not.toHaveProperty("aggregateRating");
    expect(result.nutrition).toBeUndefined();
  });
});
