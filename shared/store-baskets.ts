import type { StoreComparison } from "./yandex";
import { summarizeComparison } from "./comparison";

/** Compare full baskets only: an incomplete cheap subtotal is not a cheaper basket. */
export function summarizeStoreBasket(
  offer: StoreComparison,
  expectedIds: string[],
) {
  const expected = new Set(expectedIds);
  const lines = offer.lines.filter((line) => expected.has(line.itemId));
  const available = lines.filter(
    (line) =>
      !line.error &&
      line.selected?.available &&
      line.selected.storeId === offer.storeId &&
      Number.isFinite(line.selected.price) &&
      line.selected.price >= 0,
  );
  const base = summarizeComparison({ ...offer, lines });
  const found = new Set(available.map((line) => line.itemId)).size;
  const complete =
    base.complete &&
    expected.size > 0 &&
    found === expected.size &&
    lines.length === expected.size &&
    new Set(lines.map((line) => line.itemId)).size === lines.length;
  return {
    ...base,
    lines,
    complete,
    found,
    expected: expected.size,
    hasPrice: available.length > 0,
    subtotal:
      available.reduce(
        (sum, line) =>
          sum + Math.round(line.selected!.price * 100) * line.quantity,
        0,
      ) / 100,
  };
}
export function cheapestCompleteBasket(
  offers: StoreComparison[],
  expectedIds: string[],
) {
  return (
    offers
      .map((offer) => ({
        ...offer,
        ...summarizeStoreBasket(offer, expectedIds),
      }))
      .filter((offer) => offer.complete)
      .sort((a, b) => a.subtotal - b.subtotal)[0] || null
  );
}
