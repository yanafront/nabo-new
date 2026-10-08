import type { Item } from "../data/catalog";
import type { AccountCartItem, ProductResult, CompareItem } from "./yandex";
import { retailProduct } from "./recipe-basket";
export function accountCartItems(items: Item[]): AccountCartItem[] {
  return items
    .filter((item) => item.product?.sourceId && item.product.storeId)
    .map((item) => ({
      id: item.product!.sourceId!,
      storeId: item.product!.storeId!,
      name: item.product!.name,
      count: item.quantity,
      image: item.product!.image || null,
      unit: item.product!.unit || null,
    }));
}
export function refreshedItem(item: Item, result?: ProductResult): Item {
  if (!item.product) return item;
  if (
    !result ||
    item.product.sourceId !== result.id ||
    item.product.storeId !== result.storeId
  ) {
    return {
      ...item,
      product: {
        ...item.product,
        price: null,
        refreshStatus: "error",
        refreshError:
          "Бэкенд не подтвердил цену этого товара. Обновите цены ещё раз.",
      },
    };
  }
  if (
    result.status === "ok" &&
    result.product &&
    result.product.id === result.id &&
    result.product.storeId === result.storeId
  ) {
    return {
      ...item,
      product: {
        ...retailProduct(result.product),
        searchQuery: item.product.searchQuery || item.requirement?.query,
        refreshStatus: result.product.available ? "ok" : "not_found",
        price: result.product.available ? result.product.price : null,
      },
    };
  }
  return {
    ...item,
    product: {
      ...item.product,
      price: null,
      refreshStatus: result.status === "not_found" ? "not_found" : "error",
      refreshError: result.error,
    },
  };
}
export function restoredCartItems(items: AccountCartItem[]): Item[] {
  return items.map((item) =>
    refreshedItem(
      {
        productId: `${item.storeId}:${item.id}`,
        quantity: item.count,
        product: {
          id: `${item.storeId}:${item.id}`,
          sourceId: item.id,
          storeId: item.storeId,
          name: item.name,
          unit: item.unit || "Упаковка",
          image: item.image,
          price: null,
          emoji: "🛍️",
          brand: "",
          keywords: [],
        },
      },
      item.current,
    ),
  );
}

/** Comparison inputs come exclusively from a successfully loaded account cart. */
export function savedCartCompareItems(items: AccountCartItem[]): CompareItem[] {
  return items.map((item) => ({
    id: `${item.storeId}:${item.id}`,
    query: item.name.slice(0, 160),
    exactName: item.name,
    quantity: item.count,
    ...(item.unit ? { unit: item.unit } : {}),
  }));
}
