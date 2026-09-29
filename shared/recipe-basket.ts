import { packagesFor } from "./recipe/purchasing";
import type { Item, Product } from "../data/catalog";
import type { RetailProduct, StoreComparison } from "./yandex";
export function retailProduct(source: RetailProduct): Product {
  return {
    id: `${source.storeId}:${source.id}`,
    name: source.name,
    brand:
      source.storeId === "sosedi"
        ? "Соседи"
        : source.storeId === "evroopt"
          ? "Е-доставка"
          : "Яндекс Еда",
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
  const freshIngredients = new Set([
    "tomato",
    "potato",
    "beet",
    "carrot",
    "cabbage",
    "onion",
    "avocado",
    "banana",
  ]);
  const preserved =
    /маринов|сол[её]н|консерв|пюре|суш[её]н|чипс|соус|салат|паста|сок|приправа|жарен|заморож/i;
  const options = offers.map((offer) => {
    const items: Item[] = [];
    const missing: string[] = [];
    let adjusted = false;
    for (const line of offer.lines) {
      const suitable = (p: RetailProduct) =>
        p.available &&
        (line.demand
          ? packagesFor(p, line.demand) !== undefined
          : p.stock === null || p.stock >= line.quantity) &&
        (!freshIngredients.has(line.itemId) || !preserved.test(p.name));
      const source = line.error
        ? null
        : line.selected && suitable(line.selected)
          ? line.selected
          : line.alternatives.find(suitable);
      if (!source || !source.available) {
        missing.push(line.query);
        continue;
      }
      const product = retailProduct(source);
      const existing = items.find((i) => i.productId === product.id);
      const quantity =
        (existing?.quantity || 0) +
        (line.demand ? packagesFor(source, line.demand)! : line.quantity);
      if (quantity > 99 || (source.stock !== null && quantity > source.stock)) {
        missing.push(line.query);
        continue;
      }
      if (source.id !== line.selected?.id) adjusted = true;
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
      adjusted,
      storeId: offer.storeId,
      matched: offer.lines.length - missing.length,
      total: items.reduce(
        (sum, i) => sum + (i.product!.price || 0) * i.quantity,
        0,
      ),
    };
  });
  return options.sort((a, b) => b.matched - a.matched || a.total - b.total)[0];
}
