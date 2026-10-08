import type { Item } from "../data/catalog";
import type { RetailProduct } from "./yandex";
import { retailProduct } from "./recipe-basket";
export class CartChangeError extends Error {}
export function appendCartItems(current: Item[], additions: Item[]): Item[] {
  const next = current.map((row) => ({ ...row }));
  for (const row of additions) {
    const existing = next.find((item) => item.productId === row.productId);
    if (existing) {
      if (existing.quantity + row.quantity > 99)
        throw new CartChangeError(
          "Можно выбрать не более 99 упаковок одного товара.",
        );
      existing.quantity += row.quantity;
    } else next.push({ ...row });
  }
  if (next.length > 200)
    throw new CartChangeError("В корзине может быть до 200 позиций.");
  return next;
}
export function selectCartProduct(
  current: Item[],
  source: RetailProduct,
  replaceId?: string,
): Item[] {
  if (!source.available) throw new CartChangeError("Товар сейчас недоступен");
  const product = retailProduct(source);
  const old = replaceId
    ? current.find((row) => row.productId === replaceId)
    : undefined;
  if (replaceId && !old)
    throw new CartChangeError("Товар для замены уже удалён");
  if (old?.productId === product.id) return current;
  const next = appendCartItems(
    current.filter((row) => row.productId !== replaceId),
    [{ productId: product.id, product, quantity: old?.quantity || 1 }],
  );
  const chosen = next.find((row) => row.productId === product.id)!;
  if (source.stock !== null && chosen.quantity > source.stock)
    throw new CartChangeError("Больше нет в наличии");
  return next;
}
