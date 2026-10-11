import type { Item } from "../data/catalog";
import { retailStores } from "./yandex";

export const guestCartKey = "nabo-guest-cart-v1";
export interface GuestCart {
  items: Item[];
  title: string;
  unresolved: string[];
  pendingIngredients: Item[];
}
/** Session storage is untrusted input; reject malformed product references and counts. */
export function parseGuestCart(raw: string | null): GuestCart | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    const rows = (value: unknown): value is Item[] =>
      Array.isArray(value) &&
      value.length <= 200 &&
      value.every(
        (row) =>
          row &&
          typeof row.productId === "string" &&
          Number.isInteger(row.quantity) &&
          row.quantity >= 1 &&
          row.quantity <= 99 &&
          row.product &&
          typeof row.product.name === "string" &&
          typeof row.product.unit === "string" &&
          typeof row.product.sourceId === "string" &&
          row.product.sourceId.length > 0 &&
          retailStores.some((store) => store.id === row.product.storeId) &&
          row.productId === `${row.product.storeId}:${row.product.sourceId}` &&
          (row.product.price === null ||
            (typeof row.product.price === "number" &&
              Number.isFinite(row.product.price) &&
              row.product.price >= 0)),
      );
    if (!rows(data.items)) return null;
    return {
      items: data.items,
      title:
        typeof data.title === "string"
          ? data.title.slice(0, 200)
          : "Моя корзина",
      unresolved: Array.isArray(data.unresolved)
        ? data.unresolved
            .filter((name: unknown) => typeof name === "string")
            .slice(0, 200)
        : [],
      pendingIngredients: Array.isArray(data.pendingIngredients)
        ? data.pendingIngredients
            .filter(
              (row: any) =>
                row &&
                typeof row.productId === "string" &&
                Number.isInteger(row.quantity) &&
                row.quantity >= 1 &&
                row.quantity <= 99 &&
                row.product &&
                typeof row.product.name === "string" &&
                typeof row.product.unit === "string" &&
                (!row.requirement ||
                  (typeof row.requirement.query === "string" &&
                    typeof row.requirement.ingredientId === "string" &&
                    Number.isFinite(row.requirement.amount) &&
                    row.requirement.amount > 0 &&
                    ["mass", "volume", "count"].includes(
                      row.requirement.dimension,
                    ))),
            )
            .slice(0, 200)
        : [],
    };
  } catch {
    return null;
  }
}
