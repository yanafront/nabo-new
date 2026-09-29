import { products, type Item } from "~/data/catalog";
import type { StoreComparison } from "~/shared/yandex";
import { recipeBasket } from "~/shared/recipe-basket";
export function useRecipeBasket() {
  const { items, title, unresolved, pendingIngredients, notice } = useBasket();
  const { location } = useRetail();
  const resolving = useState("recipe-resolving", () => false);
  const resolveError = useState("recipe-error", () => "");
  async function resolve(
    request: { title: string; items: Item[]; manual?: string[] },
    signal?: AbortSignal,
    keepCurrent = false,
  ) {
    if (resolving.value) return false;
    resolving.value = true;
    resolveError.value = "";
    const point = JSON.stringify(location.value);
    try {
      const queries = request.items.map((i) => {
        const p = i.product || products.find((p) => p.id === i.productId);
        if (!p) throw new Error();
        return {
          id: i.productId,
          query: p.name,
          unit: p.unit,
          quantity: i.quantity,
          requirement: i.requirement,
        };
      });
      const response = await $fetch<{ offers: StoreComparison[] }>(
        "/api/yandex/compare",
        {
          method: "POST",
          body: { items: queries, location: location.value },
          signal,
          timeout: 120000,
          retry: 0,
        },
      );
      if (signal?.aborted) return false;
      if (point !== JSON.stringify(location.value)) {
        resolveError.value = "Точка доставки изменилась. Повторите подбор.";
        return false;
      }
      const basket = recipeBasket(response.offers, request.items);
      if (!basket?.items.length) {
        resolveError.value =
          "Не удалось подобрать товары в магазинах. Попробуйте снова или добавьте их через поиск.";
        return false;
      }
      const next = keepCurrent
        ? (JSON.parse(JSON.stringify(items.value)) as Item[])
        : [];
      for (const row of basket.items) {
        const existing = next.find((i) => i.productId === row.productId);
        if (existing) {
          if (existing.quantity + row.quantity > 99) throw new Error();
          existing.quantity += row.quantity;
          delete existing.requirement; // Preserve the explicit combined package count.
        } else next.push(row);
      }
      if (next.length > 20) {
        resolveError.value =
          "В корзине может быть до 20 позиций. Удалите лишнее и повторите.";
        return false;
      }
      items.value = next;
      title.value = keepCurrent ? "Корзина из нескольких блюд" : request.title;
      unresolved.value = [
        ...new Set([
          ...(keepCurrent ? unresolved.value : []),
          ...(request.manual || []),
          ...basket.missing,
        ]),
      ];
      pendingIngredients.value = [];
      notice.value = keepCurrent
        ? "Продукты блюда добавлены в корзину"
        : basket.adjusted
          ? "Товары подобраны. Проверьте размеры упаковок."
          : "Реальные товары добавлены в корзину";
      return true;
    } catch {
      if (!signal?.aborted)
        resolveError.value =
          "Не удалось получить товары. Проверьте соединение и повторите.";
      return false;
    } finally {
      resolving.value = false;
    }
  }
  return { resolve, resolving, resolveError };
}
