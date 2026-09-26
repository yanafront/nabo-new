import type { Item } from "../data/catalog";
import type { StoreComparison, CompareLine } from "./yandex";
import { summarizeComparison } from "./comparison";
const normalized = (value: string) =>
  value.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
export function withPreferences(
  offer: StoreComparison,
  items: Item[],
): StoreComparison {
  return {
    ...offer,
    lines: offer.lines.map((line) => {
      const item = items.find((item) => item.productId === line.itemId);
      if (item?.allowReplacement !== false || !item.product) return line;
      const matches = (p: NonNullable<CompareLine["selected"]>) =>
        normalized(p.name) === normalized(item.product!.name) &&
        normalized(p.unit) === normalized(item.product!.unit);
      return {
        ...line,
        selected:
          line.selected && matches(line.selected) ? line.selected : null,
        alternatives: line.alternatives.filter(matches),
      };
    }),
  };
}
const signature = (offer: StoreComparison) =>
  JSON.stringify(
    offer.lines
      .map((l) => [l.itemId, l.quantity])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  );
export function recommend(offers: StoreComparison[]) {
  const full = offers
    .map((offer) => ({ offer, ...summarizeComparison(offer) }))
    .filter((o) => o.complete)
    .sort((a, b) => a.subtotal - b.subtotal);
  const best = full[0];
  const next =
    best &&
    full.find(
      (o) =>
        o.offer.storeId !== best.offer.storeId &&
        signature(o.offer) === signature(best.offer),
    );
  const saving =
    next && best ? Math.round((next.subtotal - best.subtotal) * 100) / 100 : 0;
  let split: {
    groups: StoreComparison[];
    subtotal: number;
    saving: number;
  } | null = null;
  for (let a = 0; a < offers.length; a++)
    for (let b = a + 1; b < offers.length; b++) {
      const left = offers[a],
        right = offers[b];
      if (!left.lines.length || signature(left) !== signature(right)) continue;
      const groups: StoreComparison[] = [
        { ...left, lines: [] },
        { ...right, lines: [] },
      ];
      let covered = true;
      for (const line of left.lines) {
        const other = right.lines.find((l) => l.itemId === line.itemId)!;
        const candidates = [line, other]
          .map((l, index) => ({ l, index }))
          .filter(
            ({ l }) =>
              !l.error &&
              l.selected?.available &&
              (l.selected.stock === null || l.selected.stock >= l.quantity),
          )
          .sort((x, y) => x.l.selected!.price - y.l.selected!.price);
        if (!candidates.length) {
          covered = false;
          break;
        }
        const choice = candidates[0];
        groups[choice.index].lines.push(choice.l);
      }
      if (
        !covered ||
        groups.some((g) => !g.lines.length || !summarizeComparison(g).complete)
      )
        continue;
      const subtotal =
        Math.round(
          groups.reduce((sum, g) => sum + summarizeComparison(g).subtotal, 0) *
            100,
        ) / 100;
      const saved = best
        ? Math.round((best.subtotal - subtotal) * 100) / 100
        : 0;
      if (best && (signature(left) !== signature(best.offer) || saved <= 0))
        continue;
      if (!split || subtotal < split.subtotal)
        split = { groups, subtotal, saving: saved };
    }
  return {
    best: best?.offer || null,
    saving,
    baseline: next?.offer.storeId || null,
    split,
  };
}
