import { products, recipes, type Item } from "../data/catalog";

export const money = (value: number) =>
  new Intl.NumberFormat("ru-BY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

/** Local recipe matching, without a model or external request. */
export function parseRequest(
  query: string,
): { title: string; items: Item[] } | null {
  const q = query.toLowerCase();
  const matched = recipes.filter((recipe) =>
    q.includes(
      recipe.id === "borscht"
        ? "борщ"
        : recipe.id === "pasta"
          ? "паст"
          : "завтрак",
    ),
  );
  const quantities = new Map<string, number>();
  for (const recipe of matched) {
    const people = Math.min(
      30,
      Math.max(1, Number(q.match(/\d+/)?.[0] || recipe.people)),
    );
    for (const id of recipe.items) {
      quantities.set(
        id,
        (quantities.get(id) || 0) +
          Math.max(1, Math.ceil(people / recipe.people)),
      );
    }
  }
  // A request can also include products alongside a recipe.
  for (const product of products) {
    if (
      product.keywords.some((keyword) => q.includes(keyword)) &&
      !quantities.has(product.id)
    ) {
      quantities.set(product.id, 1);
    }
  }
  return quantities.size
    ? {
        title: query.trim(),
        items: [...quantities].map(([productId, quantity]) => ({
          productId,
          quantity,
        })),
      }
    : null;
}
