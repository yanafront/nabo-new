import { separateLegacyIngredientNames } from "../shared/recipe/ingredient-names";
import { describe, it, expect } from "vitest";
import {
  migrateLegacy,
  validateCatalog,
  parseRecipeCsv,
} from "../shared/recipe/import";
import {
  perServing,
  scaledIngredients,
  type Recipe,
} from "../shared/recipe/model";
import { listRecipes } from "../shared/recipe/search";
import catalog from "./fixtures/recipes.json";
import {
  packagesFor,
  packageMeasure,
  selectDemand,
  recipePurchaseRequest,
} from "../shared/recipe/purchasing";
import type { RetailProduct } from "../shared/yandex";
const recipe = catalog.recipes.find(
  (r) => r.slug === "spaghetti-carbonara",
) as Recipe;
const p: RetailProduct = {
  id: "a",
  storeId: "green",
  placeSlug: "green",
  name: "Филе куриное",
  unit: "450 г",
  price: 5,
  oldPrice: null,
  image: null,
  stock: 10,
  available: true,
  fetchedAt: "2026-09-26T00:00:00Z",
};
const demand = {
  ingredientId: "chicken-breast",
  query: "Куриное филе",
  amount: 600,
  dimension: "mass" as const,
};
describe("normalized recipe catalogue", () => {
  it("keeps carbonara composition from the source and scales 2 to 4", () => {
    expect(recipe.servings).toBe(2);
    expect(
      scaledIngredients(recipe, 4).find((i) => i.name === "Спагетти")?.quantity,
    ).toBe(400);
    expect(
      recipe.ingredients.find((i) => i.name === "Спагетти")?.quantity,
    ).toBe(200);
  });
  it("normalizes source totals and leaves per-serving values stable", () => {
    const r = {
      ...recipe,
      nutrition: {
        calories: 1200,
        protein: 40,
        fat: 50,
        carbs: 100,
        basis: "recipe" as const,
        calculationType: "source" as const,
        source: "fixture",
      },
    };
    expect(perServing(r)?.calories).toBe(600);
    scaledIngredients(r, 4);
    expect(perServing(r)?.calories).toBe(600);
    expect(
      perServing({
        ...r,
        nutrition: { ...r.nutrition, basis: "100g" },
        yieldGrams: 500,
      })?.calories,
    ).toBe(3000);
    expect(
      perServing({ ...r, nutrition: { ...r.nutrition, basis: "100g" } }),
    ).toBeUndefined();
  });
  it("does not fabricate missing nutrition", () =>
    expect(perServing({ ...recipe, nutrition: undefined })).toBeUndefined());
  it("finds carbonara and respects categories", () => {
    const c = validateCatalog(structuredClone(catalog));
    expect(
      listRecipes(c.recipes, c.ingredients, { q: "карбонара" }).recipes[0]
        ?.slug,
    ).toBe("spaghetti-carbonara");
    expect(
      listRecipes(c.recipes, c.ingredients, {
        category: "mains",
      }).recipes.every((r) => r.categoryId === "mains"),
    ).toBe(true);
  });
  it("builds useful ingredient-based chicken, meat and fish categories", () => {
    const c = validateCatalog(structuredClone(catalog));
    // Category semantics must work independently of the size of a source catalogue.
    c.recipes.push({
      ...recipe,
      id: "chicken-fixture",
      slug: "chicken-fixture",
      title: "Курица с рисом",
      ingredients: [],
    });
    c.recipes.push({
      ...recipe,
      id: "meat-fixture",
      slug: "meat-fixture",
      title: "Говядина с овощами",
      ingredients: [],
    });
    for (const category of ["chicken", "meat", "fish"]) {
      const result = listRecipes(c.recipes, c.ingredients, {
        category,
        limit: 3,
      });
      expect(result.total).toBeGreaterThan(0);
      expect(result.recipes).toHaveLength(Math.min(3, result.total));
    }
    expect(
      listRecipes(c.recipes, c.ingredients, { category: "fish", limit: 100 })
        .recipes,
    ).not.toContainEqual(expect.objectContaining({ slug: "rolex-uganda" }));
    expect(
      listRecipes(c.recipes, c.ingredients, { category: "fish", limit: 100 })
        .recipes,
    ).not.toContainEqual(expect.objectContaining({ slug: "avgolemono" }));
  });
  it("matches pasta synonyms and Russian forms with AND semantics", () => {
    const a = {
      ...recipe,
      title: "Сливочная паста с курицей",
      description: "",
      ingredients: [],
    };
    expect(listRecipes([a], [], { q: "макароны с курицей" }).total).toBe(1);
    expect(listRecipes([a], [], { q: "макароны с говядиной" }).total).toBe(0);
  });
  it("rejects dangling ingredient references and malformed nutrition", () => {
    const c = structuredClone(catalog);
    c.recipes[0]!.ingredients[0]!.ingredientId = "does-not-exist";
    expect(() => validateCatalog(c)).toThrow();
    expect(() =>
      validateCatalog({
        ...catalog,
        recipes: [{ ...recipe, nutrition: { calories: 20 } }],
      }),
    ).toThrow();
  });
  it("imports quoted CSV with nested JSON", () => {
    const header = [
      "id",
      "title",
      "slug",
      "servings",
      "categoryId",
      "tags",
      "ingredients",
      "source",
      "sourceId",
      "isActive",
    ];
    const row = header
      .map((k) => {
        const v = (recipe as any)[k];
        return (
          '"' +
          (typeof v === "object" ? JSON.stringify(v) : String(v)).replaceAll(
            '"',
            '""',
          ) +
          '"'
        );
      })
      .join(",");
    expect(
      parseRecipeCsv(header.join(",") + "\n" + row, catalog.ingredients)
        .recipes[0]?.title,
    ).toBe(recipe.title);
    expect(() => parseRecipeCsv('id\n"unclosed', [])).toThrow();
  });
});
describe("independent ingredient searches", () => {
  it("sends separate sour cream and jam queries from syrniki", () => {
    const syrniki = catalog.recipes.find((r) => r.slug === "syrniki") as Recipe;
    const request = recipePurchaseRequest(syrniki, catalog.ingredients, 2, []);
    const names = request.items.map((i) => i.product?.name);
    expect(names).toContain("Сметана");
    expect(names).toContain("Варенье");
    expect(names).not.toContain("Сметана и варенье");
    expect(syrniki.nutrition?.source).toContain("UniTools");
    expect(syrniki.instructions?.length).toBeGreaterThan(0);
  });
  it("prevents publishing compound search queries and shared amounts", () => {
    const c = structuredClone(catalog);
    c.ingredients[0]!.searchTerms = ["Сметана и варенье"];
    expect(() => validateCatalog(c)).toThrow();
    expect(() =>
      migrateLegacy({
        recipes: [
          {
            slug: "test",
            name: { ru: "Блюдо" },
            baseServings: 2,
            prepMinutes: 1,
            cookMinutes: 1,
            ingredients: [
              { name: { ru: "Сметана и варенье" }, quantity: 100, unit: "g" },
            ],
          },
        ],
      }),
    ).toThrow(/количество каждого/);
  });
  it("migrates old missing-ingredient notices without discarding other items", () => {
    expect(
      separateLegacyIngredientNames([
        "Сметана и варенье",
        "Картофель",
        "Сметана",
      ]),
    ).toEqual(["Сметана", "Варенье", "Картофель"]);
  });
});
describe("buying whole packages", () => {
  it("keeps all selected syrniki ingredients including spoon and to-taste amounts", () => {
    const syrniki = catalog.recipes.find((r) => r.slug === "syrniki") as Recipe;
    const request = recipePurchaseRequest(syrniki, catalog.ingredients, 2, [
      "5",
      "6",
    ]);
    expect(request.items).toHaveLength(7);
    expect(request.items.filter((item) => !item.requirement)).toHaveLength(5);
    expect(request.manual).toEqual([]);
    expect(
      recipePurchaseRequest(syrniki, catalog.ingredients, 2, []).items,
    ).toHaveLength(9);
  });
  it("buys 2 × 450 g for 600 g and handles multipacks", () => {
    expect(packagesFor(p, demand)).toBe(2);
    expect(packageMeasure("2 × 450 г")).toEqual({
      amount: 900,
      dimension: "mass",
    });
    expect(packagesFor({ ...p, unit: "2 × 450 г" }, demand)).toBe(1);
  });
  it("does not guess unknown size or convert grams into millilitres", () => {
    expect(
      packagesFor({ ...p, unit: "", name: "Филе" }, demand),
    ).toBeUndefined();
    expect(packagesFor({ ...p, unit: "1 л" }, demand)).toBeUndefined();
    expect(packagesFor({ ...p, stock: 1 }, demand)).toBeUndefined();
  });
  it("ranks by cost of actual packages, not pack price", () => {
    const b = { ...p, id: "b", unit: "1 кг", price: 8 };
    const line = selectDemand(
      {
        itemId: "chicken",
        query: "курица",
        quantity: 1,
        selected: p,
        alternatives: [p, b],
      },
      demand,
    );
    expect(line.selected?.id).toBe("b");
    expect(line.quantity).toBe(1);
  });
  it("uses one package for to taste and respects excluded pantry ingredients", () => {
    const r = {
      ...recipe,
      ingredients: [
        {
          ingredientId: "salt",
          name: "Соль",
          quantity: 0,
          unit: "toTaste" as const,
          unquantified: true,
        },
      ],
    };
    const salt = {
      id: "salt",
      name: "Соль",
      aliases: [],
      searchTerms: ["соль"],
      pantry: true,
      common: true,
    };
    expect(recipePurchaseRequest(r, [salt], 2, []).items).toEqual([
      expect.objectContaining({
        quantity: 1,
        product: expect.objectContaining({ name: "соль" }),
      }),
    ]);
    expect(recipePurchaseRequest(r, [salt], 2, ["0"]).manual).toEqual([]);
  });
  it("keeps similarly named legacy IDs separate when their names differ", () => {
    const c = migrateLegacy({
      recipes: [
        {
          slug: "a",
          name: { ru: "Блюдо" },
          baseServings: 2,
          prepMinutes: 1,
          cookMinutes: 1,
          ingredients: [
            { id: "cream", name: { ru: "Сливки" }, quantity: 20, unit: "g" },
            { id: "cream", name: { ru: "Сметана" }, quantity: 20, unit: "g" },
          ],
        },
      ],
    });
    expect(c.recipes[0]!.ingredients[0]!.ingredientId).not.toBe(
      c.recipes[0]!.ingredients[1]!.ingredientId,
    );
  });
});
