import { products, type Item } from "~/data/catalog";
import type { SearchAllResult } from "~/shared/yandex";
import { recipeSearchBasket } from "~/shared/recipe-search-basket";
import { normalized } from "~/shared/recipe/model";
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
          query: p.searchQuery || i.requirement?.query || p.name,
          ...(p.exactName ? { exactName: p.exactName } : {}),
          unit: p.unit,
          quantity: i.quantity,
        };
      });
      // Limit parallel retail searches; a single failed ingredient does not discard others.
      const results: Array<SearchAllResult | null> = queries.map(() => null);
      let cursor = 0;
      await Promise.all(
        Array.from({ length: Math.min(3, queries.length) }, async () => {
          while (cursor < queries.length && !signal?.aborted) {
            const index = cursor++;
            try {
              results[index] = await $fetch<SearchAllResult>("/api/search", {
                method: "POST",
                body: {
                  query: queries[index]!.query,
                  location: JSON.parse(point),
                },
                signal,
                timeout: 70000,
                retry: 0,
              });
            } catch {
              /* Keep this ingredient available for a retry. */
            }
          }
        }),
      );
      if (signal?.aborted) return false;
      if (point !== JSON.stringify(location.value)) {
        resolveError.value = "Точка доставки изменилась. Повторите подбор.";
        return false;
      }
      const basket = recipeSearchBasket(
        request.items.map((row) => ({
          ...row,
          product: row.product || products.find((p) => p.id === row.productId)!,
        })),
        results,
      );
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
          if (existing.product)
            existing.product.searchQuery ||=
              existing.requirement?.query || row.product?.searchQuery;
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
          ...(keepCurrent
            ? unresolved.value.filter(
                (name) =>
                  !basket.resolvedQueries.some(
                    (query) => normalized(query) === normalized(name),
                  ),
              )
            : []),
          ...(request.manual || []),
          ...basket.missing,
        ]),
      ];
      const queryFor = (row: Item) =>
        row.requirement?.query ||
        row.product?.name ||
        products.find((p) => p.id === row.productId)?.name ||
        "";
      const requestedQueries = new Set(
        request.items.map((row) => normalized(queryFor(row))),
      );
      pendingIngredients.value = [
        ...(keepCurrent
          ? pendingIngredients.value.filter(
              (row) => !requestedQueries.has(normalized(queryFor(row))),
            )
          : []),
        ...request.items.filter((row) =>
          basket.missingIds.includes(row.productId),
        ),
      ];
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
  async function retryMissing() {
    const pending = [...pendingIngredients.value];
    const known = new Set(
      pending.map((row) =>
        normalized(
          row.requirement?.query ||
            row.product?.name ||
            products.find((p) => p.id === row.productId)?.name ||
            "",
        ),
      ),
    );
    for (const [index, name] of unresolved.value.entries()) {
      if (known.has(normalized(name))) continue;
      const id = `retry:ingredient:${index}`;
      pending.push({
        productId: id,
        quantity: 1,
        product: {
          id,
          name,
          unit: "",
          price: null,
          brand: "",
          emoji: "🛒",
          keywords: [],
        },
      });
    }
    if (!pending.length) return false;
    const currentTitle = title.value;
    const success = await resolve(
      { title: currentTitle, items: pending },
      undefined,
      true,
    );
    if (success) title.value = currentTitle;
    return success;
  }
  return { resolve, retryMissing, resolving, resolveError };
}
