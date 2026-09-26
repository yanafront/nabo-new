import { productImageUrl } from "../../shared/product-image";
import type { RetailProduct, StoreId } from "../../shared/yandex";
export class ProviderError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
export function decimal(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+(\.\d{1,2})?$/.test(value))
    return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n < 100000 ? n : null;
}
/** Verified against menu/search: price is truncated; only decimal fields are authoritative. */
export function normalizeSearch(
  data: unknown,
  storeId: StoreId,
  placeSlug: string,
  fetchedAt: string,
): RetailProduct[] {
  const d = data as any;
  if (!d || d.currency?.code !== "BYN" || !Array.isArray(d.blocks))
    throw new ProviderError("INVALID_RESPONSE");
  const blocks = d.blocks.filter((b: any) => b.type === "categories_products");
  if (!d.blocks.length) return [];
  if (!blocks.length) throw new ProviderError("INVALID_RESPONSE");
  const result = new Map<string, RetailProduct>();
  let invalid = 0;
  for (const block of blocks) {
    if (!Array.isArray(block.payload?.products))
      throw new ProviderError("INVALID_RESPONSE");
    for (const p of block.payload.products) {
      if (p.adult === true) continue;
      const base = decimal(p.decimalPrice);
      const promo = decimal(p.decimalPromoPrice);
      const id = p.public_id || p.uid;
      if (
        typeof id !== "string" ||
        !id ||
        typeof p.name !== "string" ||
        !p.name ||
        base === null
      ) {
        invalid++;
        continue;
      }
      const price = promo !== null && promo < base ? promo : base;
      const image = productImageUrl(p.picture?.url);
      const stock =
        typeof p.inStock === "number" && Number.isFinite(p.inStock)
          ? Math.max(0, Math.floor(p.inStock))
          : null;
      result.set(id, {
        id,
        storeId,
        placeSlug,
        name: p.name,
        description:
          typeof p.description === "string" && p.description.trim()
            ? p.description.trim().slice(0, 2000)
            : undefined,
        rating:
          typeof p.rating?.text === "string"
            ? p.rating.text.slice(0, 80)
            : undefined,
        unit: typeof p.weight === "string" ? p.weight : "Упаковка не указана",
        price,
        oldPrice: price < base ? base : null,
        image,
        stock,
        available: p.available === true && (stock === null || stock > 0),
        fetchedAt,
      });
    }
  }
  if (invalid && !result.size) throw new ProviderError("INVALID_RESPONSE");
  return [...result.values()];
}
export function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/(\d)[.,](\d)/g, "$1d$2")
    .replace(/[^\p{L}\p{N}%]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}
/** Compare physical pack sizes, without treating grams of milk as millilitres. */
export function packKey(value: string): string | null {
  const match = value
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .match(/(\d+(?:[.,]\d+)?)\s*(кг|мл|шт|г|л)(?=$|[\s.,/])/u);
  if (!match) return null;
  const n = Number(match[1].replace(",", "."));
  const unit = match[2];
  const amount = unit === "кг" || unit === "л" ? n * 1000 : n;
  return `${unit === "кг" || unit === "г" ? "mass" : unit === "шт" ? "count" : "volume"}:${Math.round(amount)}`;
}
export function selectCandidates(
  products: RetailProduct[],
  query: string,
  quantity: number,
  exactName?: string,
  unit?: string,
) {
  const tokens = normalizeName(query)
    .split(" ")
    .filter((t) => t.length > 1)
    .map((t) => (t === "яйца" ? "яйц" : t));
  const candidates = products.filter(
    (p) =>
      p.available &&
      (p.stock === null || p.stock >= quantity) &&
      tokens.every((t) => normalizeName(p.name).includes(t)),
  );
  const expected = unit ? packKey(unit) : null;
  const selected = exactName
    ? candidates.find(
        (p) =>
          normalizeName(p.name) === normalizeName(exactName) &&
          p.unit.replace(/\s/g, "") === (unit || "").replace(/\s/g, ""),
      )
    : candidates.find(
        (p) =>
          !expected ||
          packKey(p.unit) === expected ||
          packKey(p.name) === expected,
      );
  const alternatives = candidates.slice(0, 15);
  if (selected && !alternatives.some((p) => p.id === selected.id))
    alternatives.unshift(selected);
  return { selected: selected || null, alternatives };
}

/** Broaden known grocery names without treating a brand as a product category. */
export function replacementQuery(name: string) {
  const match = name
    .toLowerCase()
    .replace(/ё/g, "е")
    .match(
      /^(молоко|кефир|сметана|творог|йогурт|сыр|масло сливочное|масло подсолнечное|яйца|хлеб|батон|картофель|морковь|свекла|капуста белокочанная|лук репчатый|томаты|помидоры|огурцы|бананы|яблоки|макароны|спагетти|рис|гречка|сахар|соль)(?=\s|$)/,
    );
  return match?.[1] || name;
}

export function selectBasketCandidates(
  products: RetailProduct[],
  query: string,
  quantity: number,
  exactName?: string,
  unit?: string,
) {
  const result = selectCandidates(products, query, quantity, exactName, unit);
  if (!result.selected && exactName) {
    const expected = unit ? packKey(unit) : null;
    result.selected =
      result.alternatives.find(
        (p) => expected && packKey(p.unit) === expected,
      ) ||
      result.alternatives[0] ||
      null;
  }
  return {
    ...result,
    replacement:
      !!result.selected &&
      !!exactName &&
      (normalizeName(result.selected.name) !== normalizeName(exactName) ||
        result.selected.unit !== unit),
  };
}
