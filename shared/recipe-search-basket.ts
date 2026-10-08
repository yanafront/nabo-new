import type { Item } from "../data/catalog";
import type { SearchAllResult } from "./yandex";
import { normalized } from "./recipe/model";
import { retailProduct } from "./recipe-basket";

/** Recipes may select the first suitable search result; manual searches never do. */
export function recipeSearchBasket(
  requests: Item[],
  results: Array<SearchAllResult | null>,
) {
  const items: Item[] = [];
  const missing: string[] = [],
    missingIds: string[] = [],
    resolvedQueries: string[] = [];
  requests.forEach((request, index) => {
    const input = request.product!;
    const query = input.searchQuery || request.requirement?.query || input.name;
    const source = results[index]?.stores
      .filter((store) => store.status === "ok")
      .flatMap((store) => store.products)
      .find(
        (product) =>
          product.available &&
          (!input.exactName ||
            normalized(product.name) === normalized(input.exactName)) &&
          (!input.unit || normalized(product.unit) === normalized(input.unit)),
      );
    if (!source) {
      missing.push(query);
      missingIds.push(request.productId);
      return;
    }
    const product = { ...retailProduct(source), searchQuery: query };
    const existing = items.find((row) => row.productId === product.id);
    if (existing) existing.quantity += request.quantity;
    else items.push({ ...request, productId: product.id, product });
    resolvedQueries.push(query);
  });
  return { items, missing, missingIds, resolvedQueries, adjusted: true };
}
