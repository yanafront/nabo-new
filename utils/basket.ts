import { products, type Item } from "../data/catalog";

export const money = (value: number) =>
  new Intl.NumberFormat("ru-BY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

/** Explicit product lists only. Recipe composition comes from the normalized catalogue. */
export function parseRequest(
  query: string,
): { title: string; items: Item[] } | null {
  const q = query.toLowerCase();
  const quantities = new Map<string, number>();
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
