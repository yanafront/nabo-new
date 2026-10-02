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
});
afterEach(() => vi.unstubAllGlobals());
it("does not save the same selection twice", () => {
  const basket = useBasket();
  basket.items.value = [{ productId: "green:12", quantity: 2 }];
  basket.save();
  basket.save();
  expect(basket.saved.value).toHaveLength(1);
  expect(basket.notice.value).toBe("Такая подборка уже есть в сохранённом");
});
it("recognizes reordered items with a different title or price", () => {
  const basket = useBasket();
  basket.items.value = [
    { productId: "green:12", quantity: 2 },
    { productId: "sosedi:12", quantity: 1 },
  ];
  basket.save();
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
  basket.save();
  expect(basket.saved.value).toHaveLength(1);
});
it("saves a new selection if the quantity or store changes", () => {
  const basket = useBasket();
  basket.items.value = [{ productId: "green:12", quantity: 2 }];
  basket.save();
  basket.items.value[0].quantity = 3;
  basket.save();
  basket.items.value = [{ productId: "sosedi:12", quantity: 3 }];
  basket.save();
  expect(basket.saved.value).toHaveLength(3);
  expect(basket.saved.value[2].items[0].quantity).toBe(2);
});
