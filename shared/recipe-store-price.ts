import type { Item } from "../data/catalog";
import type { SearchResult } from "./yandex";
import { recipeSearchBasket } from "./recipe-search-basket";
import { normalized } from "./recipe/model";
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
    // Exact names vary between retailers. Prefer the editor's exact match,
    // then retain the available results returned for its search query.
    const exact = valid?.products.filter(
      (product) =>
        (!request.product?.exactName ||
          normalized(product.name) === normalized(request.product.exactName)) &&
        (!request.product?.unit ||
          normalized(product.unit) === normalized(request.product.unit)),
    );
    const candidates = valid && {
      ...valid,
      products: [...(exact || []), ...valid.products],
    };
    const chosen = recipeSearchBasket(
      [
        {
          ...request,
          product: { ...request.product!, exactName: undefined, unit: "" },
        },
      ],
      [candidates ? { stores: [candidates] } : null],
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
