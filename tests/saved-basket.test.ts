import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { computed, ref } from "vue";
import { useBasket } from "../composables/useBasket";
beforeEach(() => {
  const states = new Map();
  vi.stubGlobal("useState", (key: string, initial: () => unknown) => {
    if (!states.has(key)) states.set(key, ref(initial()));
    return states.get(key);
  });
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("$fetch", vi.fn().mockResolvedValue({ id: "user-1" }));
  vi.stubGlobal("navigateTo", vi.fn().mockResolvedValue(undefined));
});
afterEach(() => vi.unstubAllGlobals());
it("does not save the same selection twice", async () => {
  const basket = useBasket();
  basket.items.value = [{ productId: "green:12", quantity: 2 }];
  await basket.save();
  await basket.save();
  expect(basket.saved.value).toHaveLength(1);
  expect(basket.notice.value).toBe("Такая подборка уже есть в сохранённом");
});
it("recognizes reordered items with a different title or price", async () => {
  const basket = useBasket();
  basket.items.value = [
    { productId: "green:12", quantity: 2 },
    { productId: "sosedi:12", quantity: 1 },
  ];
  await basket.save();
  basket.title.value = "Другое название";
  basket.items.value.reverse();
  basket.items.value[0].product = {
    id: "sosedi:12",
    name: "Молоко",
    price: 5,
    unit: "1 л",
    brand: "",
    emoji: "",
    keywords: [],
  };
  await basket.save();
  expect(basket.saved.value).toHaveLength(1);
});
it("saves a new selection if the quantity or store changes", async () => {
  const basket = useBasket();
  basket.items.value = [{ productId: "green:12", quantity: 2 }];
  await basket.save();
  basket.items.value[0].quantity = 3;
  await basket.save();
  basket.items.value = [{ productId: "sosedi:12", quantity: 3 }];
  await basket.save();
  expect(basket.saved.value).toHaveLength(3);
  expect(basket.saved.value[2].items[0].quantity).toBe(2);
});

it("clears the current basket and missing ingredients without deleting saved lists", async () => {
  const basket = useBasket();
  basket.items.value = [{ productId: "green:12", quantity: 2 }];
  basket.title.value = "Сырники";
  await basket.save();
  basket.unresolved.value = ["Варенье"];
  basket.pendingIngredients.value = [
    { productId: "recipe:smetana", quantity: 1 },
  ];
  basket.clear();
  expect(basket.items.value).toEqual([]);
  expect(basket.unresolved.value).toEqual([]);
  expect(basket.pendingIngredients.value).toEqual([]);
  expect(basket.title.value).toBe("Моя корзина");
  expect(basket.notice.value).toBe("Корзина очищена");
  expect(basket.saved.value).toHaveLength(1);
  expect(basket.saved.value[0].items).toEqual([
    { productId: "green:12", quantity: 2 },
  ]);
});

it("requires login before saving and preserves the basket", async () => {
  vi.mocked($fetch).mockRejectedValue({ statusCode: 401 });
  const basket = useBasket();
  basket.items.value = [{ productId: "green:12", quantity: 2 }];
  await basket.save();
  expect(basket.saved.value).toEqual([]);
  expect(basket.items.value).toEqual([{ productId: "green:12", quantity: 2 }]);
  expect(navigateTo).toHaveBeenCalledWith({
    path: "/account",
    query: { returnTo: "/basket" },
  });
  expect(basket.saving.value).toBe(false);
});
it("does not save when authentication cannot be verified", async () => {
  vi.mocked($fetch).mockRejectedValue({ statusCode: 503 });
  const basket = useBasket();
  basket.items.value = [{ productId: "green:12", quantity: 2 }];
  await basket.save();
  expect(basket.saved.value).toEqual([]);
  expect(navigateTo).not.toHaveBeenCalled();
  expect(basket.notice.value).toContain("Не удалось проверить вход");
});
