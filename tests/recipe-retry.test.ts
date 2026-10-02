import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { computed, ref } from "vue";
import { useBasket } from "../composables/useBasket";
import { useRecipeBasket } from "../composables/useRecipeBasket";
import { recipePurchaseRequest } from "../shared/recipe/purchasing";
import { validateCatalog } from "../shared/recipe/import";
import catalog from "../data/recipe-catalog.json";
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
  vi.stubGlobal("useBasket", useBasket);
  vi.stubGlobal("useRetail", () => ({
    location: ref({ lat: 53.9, lon: 27.5667, label: "Минск" }),
  }));
});
afterEach(() => vi.unstubAllGlobals());
it("retries old missing names separately and leaves existing products unchanged", async () => {
  const basket = useBasket();
  basket.addProduct(source("Творог", "curd"));
  basket.unresolved.value = ["Сметана", "Варенье"];
  basket.title.value = "Сырники";
  const fetch = vi.fn(async (_url, options) => ({
    offers: [
      {
        storeId: "green",
        lines: options.body.items.map((item: any) => ({
          itemId: item.id,
          query: item.query,
          quantity: 1,
          selected: source(item.query),
          alternatives: [],
        })),
      },
    ],
  }));
  vi.stubGlobal("$fetch", fetch);
  expect(await useRecipeBasket().retryMissing()).toBe(true);
  expect(
    fetch.mock.calls[0][1].body.items.map((item: any) => item.query),
  ).toEqual(["Сметана", "Варенье"]);
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
  vi.stubGlobal("$fetch", async (_url: string, options: any) => ({
    offers: [
      {
        storeId: "green",
        lines: options.body.items.map((item: any) => ({
          itemId: item.id,
          query: item.query,
          quantity: 1,
          selected: item.query === "Варенье" ? null : source(item.query),
          alternatives: [],
        })),
      },
    ],
  }));
  expect(await useRecipeBasket().retryMissing()).toBe(true);
  expect(basket.unresolved.value).toEqual(["Варенье"]);
  expect(
    basket.pendingIngredients.value.map((item) => item.product?.name),
  ).toEqual(["Варенье"]);
});
it("clears missing entries when the user selects the actual product manually", () => {
  const basket = useBasket();
  basket.unresolved.value = ["Сметана", "Варенье"];
  basket.addProduct(source("Сметана Савушкин 20%"));
  expect(basket.unresolved.value).toEqual(["Варенье"]);
  basket.addProduct(source("Варенье клубничное"));
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
it("restores the missing recipe demand after a browser reload", async () => {
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
  const plugin = await import("../plugins/persistence.client");
  (plugin.default as unknown as () => void)();
  expect(useBasket().pendingIngredients.value).toEqual([pending]);
});
