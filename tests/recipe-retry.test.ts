import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { computed, ref } from "vue";
import { useBasket } from "../composables/useBasket";
import { useRecipeBasket } from "../composables/useRecipeBasket";
import { recipePurchaseRequest } from "../shared/recipe/purchasing";
import { validateCatalog } from "../shared/recipe/import";
import catalog from "./fixtures/recipes.json";
const source = (name: string, id = name) => ({
  id,
  storeId: "green" as const,
  name,
  unit: "200 г",
  price: 2,
  available: true,
  stock: null,
  image: null,
  oldPrice: null,
  fetchedAt: "2026-10-02",
  placeSlug: "green",
});
beforeEach(() => {
  const states = new Map();
  vi.stubGlobal("useState", (key: string, initial: () => unknown) => {
    if (!states.has(key)) states.set(key, ref(initial()));
    return states.get(key);
  });
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("useCartSync", () => ({
    state: ref("saved"),
    error: ref(""),
    refresh: async () => true,
    mutate: async (change: (rows: any[]) => any[]) => {
      const basket = useBasket();
      basket.items.value = change(
        JSON.parse(JSON.stringify(basket.items.value)),
      );
      return true;
    },
    clear: async () => {
      useBasket().items.value = [];
      return true;
    },
  }));

  vi.stubGlobal("useBasket", useBasket);
  vi.stubGlobal("useRetail", () => ({
    location: ref({ lat: 53.9, lon: 27.5667, label: "Минск" }),
  }));
});
afterEach(() => vi.unstubAllGlobals());
it("retries old missing names separately and leaves existing products unchanged", async () => {
  const basket = useBasket();
  await basket.addProduct(source("Творог", "curd"));
  basket.unresolved.value = ["Сметана", "Варенье"];
  basket.title.value = "Сырники";
  const fetch = vi.fn(async (_url: string, options: any) => ({
    stores: [
      {
        storeId: "green",
        status: "ok",
        products: [source(options.body.query)],
      },
    ],
  }));
  vi.stubGlobal("$fetch", fetch);
  expect(await useRecipeBasket().retryMissing()).toBe(true);
  expect(fetch.mock.calls.map((call) => call[1].body.query)).toEqual([
    "Сметана",
    "Варенье",
  ]);
  expect(basket.unresolved.value).toEqual([]);
  expect(basket.items.value).toHaveLength(3);
  expect(
    basket.items.value.find((item) => item.productId === "green:curd")
      ?.quantity,
  ).toBe(1);
  expect(basket.title.value).toBe("Сырники");
});
it("keeps unsuccessful ingredient requests for another retry", async () => {
  const basket = useBasket();
  basket.unresolved.value = ["Сметана", "Варенье"];
  const fetch = vi.fn(async (_url: string, options: any) => ({
    stores: [
      {
        storeId: "green",
        status: "ok",
        products:
          options.body.query === "Варенье" ? [] : [source(options.body.query)],
      },
    ],
  }));
  vi.stubGlobal("$fetch", fetch);
  expect(await useRecipeBasket().retryMissing()).toBe(true);
  expect(basket.unresolved.value).toEqual(["Варенье"]);
  expect(
    basket.pendingIngredients.value.map((item) => item.product?.name),
  ).toEqual(["Варенье"]);
});
it("clears missing entries when the user selects the actual product manually", async () => {
  const basket = useBasket();
  basket.unresolved.value = ["Сметана", "Варенье"];
  await basket.addProduct(source("Сметана Савушкин 20%"));
  expect(basket.unresolved.value).toEqual(["Варенье"]);
  await basket.addProduct(source("Варенье клубничное"));
  expect(basket.unresolved.value).toEqual([]);
});
it("requests unquantified syrniki toppings separately, one pack each", () => {
  const data = validateCatalog(catalog);
  const recipe = data.recipes.find((recipe) => recipe.slug === "syrniki")!;
  const request = recipePurchaseRequest(recipe, data.ingredients, 2, []);
  const toppings = request.items.filter((item) =>
    ["Сметана", "Варенье"].includes(item.product?.name || ""),
  );
  expect(toppings).toHaveLength(2);
  expect(
    toppings.every((item) => item.quantity === 1 && !item.requirement),
  ).toBe(true);
  expect(toppings[0].productId).not.toBe(toppings[1].productId);
});
it("does not restore the active cart or missing ingredients from browser storage", async () => {
  const pending = {
    productId: "recipe:syrniki:curd:mass",
    quantity: 1,
    product: {
      id: "recipe:syrniki:curd:mass",
      name: "Творог",
      unit: "",
      price: null,
      brand: "",
      emoji: "",
      keywords: [],
    },
    requirement: {
      ingredientId: "curd",
      query: "Творог",
      amount: 500,
      dimension: "mass",
    },
  };
  vi.stubGlobal("localStorage", {
    setItem: vi.fn(),
    getItem: (key: string) =>
      key === "nabo-v2"
        ? JSON.stringify({ pendingIngredients: [pending] })
        : null,
  });
  vi.stubGlobal("defineNuxtPlugin", (callback: () => void) => callback);
  vi.stubGlobal("onNuxtReady", (callback: () => void) => callback());
  vi.stubGlobal("watch", () => () => {});
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal("document", {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal("$fetch", vi.fn().mockRejectedValue({ statusCode: 401 }));
  const plugin = await import("../plugins/persistence.client");
  (plugin.default as unknown as () => void)();
  expect(useBasket().pendingIngredients.value).toEqual([]);
  expect(useBasket().items.value).toEqual([]);
});
it("searches the editorial query and selects the configured exact SKU without compare", async () => {
  const sourceRecipe = structuredClone(
    validateCatalog(catalog).recipes.find((r) => r.slug === "syrniki")!,
  );
  sourceRecipe.ingredients = [sourceRecipe.ingredients[0]];
  sourceRecipe.ingredients[0].searchQuery = "Творог 5%";
  sourceRecipe.ingredients[0].exactName = "Творог Савушкин 5% 200 г";
  sourceRecipe.ingredients[0].exactUnit = "200 г";
  const request = recipePurchaseRequest(
    sourceRecipe,
    validateCatalog(catalog).ingredients,
    sourceRecipe.servings,
    [],
  );
  const fetch = vi.fn(async (_url: string, options: any) => ({
    stores: [
      {
        storeId: "green",
        status: "ok",
        products: [source("Творог Савушкин 5% 200 г", "123")],
      },
    ],
  }));
  vi.stubGlobal("$fetch", fetch);
  expect(await useRecipeBasket().resolve(request)).toBe(true);
  expect(fetch.mock.calls[0][0]).toBe("/api/search");
  expect(fetch.mock.calls[0][1].body).toMatchObject({ query: "Творог 5%" });
  expect(fetch.mock.calls[0][1].body).not.toHaveProperty("items");
});
it("keeps the editorial query after choosing a SKU, changing quantity and refreshing its price", async () => {
  const { refreshedItem } = await import("../shared/account-cart");
  const recipe = structuredClone(
    validateCatalog(catalog).recipes.find((r) => r.slug === "syrniki")!,
  );
  recipe.ingredients = [recipe.ingredients[0]];
  recipe.ingredients[0].searchQuery = "Творог 5%";
  const request = recipePurchaseRequest(
    recipe,
    validateCatalog(catalog).ingredients,
    recipe.servings,
    [],
  );
  const selected = source("Творог Савушкин 5% 200 г", "123");
  const fetch = vi.fn(async (_url: string, options: any) => ({
    stores: [{ storeId: "green", status: "ok", products: [selected] }],
  }));
  vi.stubGlobal("$fetch", fetch);
  expect(await useRecipeBasket().resolve(request)).toBe(true);
  const basket = useBasket();
  expect(basket.rows.value[0].product.name).toBe(selected.name);
  expect(basket.compareItems.value[0]).toMatchObject({
    query: selected.name,
    exactName: selected.name,
  });
  await basket.change("green:123", 1);
  expect(basket.items.value[0].requirement).toBeUndefined();
  expect(basket.compareItems.value[0]).toMatchObject({
    query: selected.name,
    quantity: 2,
  });
  basket.items.value[0] = refreshedItem(basket.items.value[0], {
    id: "123",
    storeId: "green",
    status: "ok",
    product: { ...selected, price: 3 },
    fetchedAt: selected.fetchedAt,
  });
  expect(basket.compareItems.value[0].query).toBe("Творог Савушкин 5% 200 г");
  await basket.addProduct(source("Творог другой 200 г", "456"), "green:123");
  expect(basket.compareItems.value[0].query).toBe("Творог другой 200 г");
});
it("uses the recipe query for spoon and to-taste ingredients without measurable demand", async () => {
  const recipe = structuredClone(
    validateCatalog(catalog).recipes.find((r) => r.slug === "syrniki")!,
  );
  recipe.ingredients = [
    {
      ...recipe.ingredients[0],
      quantity: 0,
      unit: "toTaste",
      unquantified: true,
      searchQuery: "Сахар ванильный",
    },
  ];
  const request = recipePurchaseRequest(
    recipe,
    validateCatalog(catalog).ingredients,
    recipe.servings,
    [],
  );
  expect(request.items[0].requirement).toBeUndefined();
  const fetch = vi.fn(async (_url: string, options: any) => ({
    stores: [
      {
        storeId: "green",
        status: "ok",
        products: [source("Сахар ванильный 10 г", "vanilla")],
      },
    ],
  }));
  vi.stubGlobal("$fetch", fetch);
  expect(await useRecipeBasket().resolve(request)).toBe(true);
  expect(useBasket().compareItems.value[0].query).toBe("Сахар ванильный 10 г");
});
it("preserves queries on older baskets when their quantity changes", async () => {
  const basket = useBasket();
  await basket.addProduct(source("Творог Савушкин 5% 200 г", "123"));
  basket.items.value[0].requirement = {
    ingredientId: "curd",
    query: "Творог 5%",
    amount: 500,
    dimension: "mass",
  };
  expect(basket.compareItems.value[0].query).toBe("Творог Савушкин 5% 200 г");
  await basket.change("green:123", 1);
  expect(basket.compareItems.value[0].query).toBe("Творог Савушкин 5% 200 г");
});
