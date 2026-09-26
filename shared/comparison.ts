import type { StoreComparison } from "./yandex";
export function summarizeComparison(offer: StoreComparison) {
  const demand = new Map<string, number>();
  for (const line of offer.lines)
    if (line.selected)
      demand.set(
        line.selected.id,
        (demand.get(line.selected.id) || 0) + line.quantity,
      );
  const stockProblems = offer.lines.filter(
    (l) =>
      l.selected &&
      l.selected.stock !== null &&
      demand.get(l.selected.id)! > l.selected.stock,
  );
  const missing = offer.lines.filter((l) => !l.selected);
  const complete =
    offer.lines.length > 0 &&
    !missing.length &&
    !stockProblems.length &&
    offer.lines.every((l) => !l.error);
  const subtotal =
    offer.lines.reduce(
      (sum, l) =>
        sum +
        (l.selected ? Math.round(l.selected.price * 100) * l.quantity : 0),
      0,
    ) / 100;
  return {
    complete,
    subtotal,
    missing,
    stockProblems,
    hasError: offer.lines.some((l) => l.error),
  };
}
