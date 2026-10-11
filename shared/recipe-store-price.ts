import type { Item } from "../data/catalog";
import type { SearchResult } from "./yandex";
import { recipeSearchBasket } from "./recipe-search-basket";
import { packagesFor, packageMeasure } from "./recipe/purchasing";
export function recipeStorePrice(
  requests: Item[],
  results: Record<string, SearchResult>,
) {
  const items: Item[] = [],
    missing: string[] = [],
    missingIds: string[] = [],
    resolvedQueries: string[] = [];
  for (const request of requests) {
    const query = recipePriceQuery(request);
    const result = results[query];
    const valid = result && {
      ...result,
      products: result.products.filter(
        (product) =>
          product.storeId === result.storeId &&
          Number.isFinite(product.price) &&
          product.price >= 0,
      ),
    };
    const chosen = recipeSearchBasket(
      [request],
      [valid ? { stores: [valid] } : null],
    ).items[0];
    const source = result?.products.find(
      (product) => product.id === chosen?.product?.sourceId,
    );
    if (!chosen || !source) {
      missing.push(query);
      missingIds.push(request.productId);
      continue;
    }
    const quantity = request.requirement
      ? packagesFor(source, request.requirement)
      : undefined;
    const measure = packageMeasure(source.unit) || packageMeasure(source.name);
    if (
      request.requirement &&
      measure?.dimension === request.requirement.dimension &&
      quantity === undefined
    ) {
      missing.push(query);
      missingIds.push(request.productId);
      continue;
    }
    chosen.quantity = quantity || request.quantity;
    const existing = items.find((row) => row.productId === chosen.productId);
    if (existing) existing.quantity += chosen.quantity;
    else items.push(chosen);
    resolvedQueries.push(query);
  }
  return {
    items,
    missing,
    missingIds,
    resolvedQueries,
    adjusted: true,
    total:
      Math.round(
        items.reduce(
          (sum, row) => sum + row.product!.price! * row.quantity,
          0,
        ) * 100,
      ) / 100,
    complete: missing.length === 0 && requests.length > 0,
    matched: requests.length - missing.length,
    requested: requests.length,
  };
}

export function recipePriceQuery(row: Item) {
  return (
    row.product?.searchQuery ||
    row.requirement?.query ||
    row.product?.name ||
    ""
  );
}
