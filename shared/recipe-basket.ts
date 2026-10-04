import type { Item, Product } from "../data/catalog";
import {
  providerName,
  type RetailProduct,
  type StoreComparison,
} from "./yandex";
export function retailProduct(source: RetailProduct): Product {
  return {
    id: `${source.storeId}:${source.id}`,
    name: source.name,
    brand: providerName(source.storeId),
    unit: source.unit,
    price: source.price,
    image: source.image,
    emoji: "🛍️",
    keywords: [],
    storeId: source.storeId,
    fetchedAt: source.fetchedAt,
    sourceId: source.id,
    externalUrl: source.externalUrl,
  };
}
/** Only actual upstream products enter a basket; missing ingredients stay outside it. */
export function recipeBasket(offers: StoreComparison[], requests: Item[] = []) {
  const options = offers.map((offer) => {
    const items: Item[] = [];
    const missing: string[] = [];
    const missingIds: string[] = [];
    const resolvedQueries: string[] = [];
    const adjusted = false;
    for (const line of offer.lines) {
      // Use the backend choice only. Alternatives require an explicit user action.
      const source = line.error ? null : line.selected;
      if (!source || !source.available) {
        missing.push(line.query);
        missingIds.push(line.itemId);
        continue;
      }
      const product = retailProduct(source);
      const existing = items.find((i) => i.productId === product.id);
      const quantity = (existing?.quantity || 0) + line.quantity;
      resolvedQueries.push(line.query);
      if (existing) {
        existing.quantity = quantity;
        const demand = requests.find(
          (i) => i.productId === line.itemId,
        )?.requirement;
        if (
          existing.requirement &&
          demand &&
          existing.requirement.ingredientId === demand.ingredientId &&
          existing.requirement.dimension === demand.dimension
        ) {
          existing.requirement = {
            ...existing.requirement,
            amount: existing.requirement.amount + demand.amount,
          };
        } else delete existing.requirement;
      } else
        items.push({
          productId: product.id,
          product,
          quantity,
          requirement: requests.find((i) => i.productId === line.itemId)
            ?.requirement,
          required: true,
        });
    }
    return {
      items,
      missing,
      missingIds,
      resolvedQueries,
      adjusted,
      storeId: offer.storeId,
      matched: offer.lines.length - missing.length,
      total: items.reduce(
        (sum, i) => sum + (i.product!.price || 0) * i.quantity,
        0,
      ),
    };
  });
  // Keep backend ordering; do not choose a cheaper or locally "better" store.
  return options.find((option) => option.items.length > 0) || options[0];
}
