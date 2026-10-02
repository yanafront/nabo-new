import type { Item } from "../../data/catalog";
import type { CompareLine, RetailProduct, StoreComparison } from "../yandex";
import {
  scaledIngredients,
  normalized,
  type Ingredient,
  type Recipe,
  type RecipeIngredient,
} from "./model";
export interface IngredientDemand {
  ingredientId: string;
  query: string;
  amount: number;
  dimension: "mass" | "volume" | "count";
  productCategoryId?: string;
}
export function demandFor(
  i: RecipeIngredient,
  d: Ingredient,
): IngredientDemand | undefined {
  if (i.unquantified || i.quantity <= 0) return;
  let amount = i.quantity,
    dimension: IngredientDemand["dimension"];
  if (i.weightGrams !== undefined) {
    amount = i.weightGrams;
    dimension = "mass";
  } else if (i.unit === "g" || i.unit === "kg") {
    amount *= i.unit === "kg" ? 1000 : 1;
    dimension = "mass";
  } else if (i.unit === "ml" || i.unit === "l") {
    amount *= i.unit === "l" ? 1000 : 1;
    dimension = "volume";
  } else if (i.unit === "piece") {
    if (d.gramsPerPiece) {
      amount *= d.gramsPerPiece;
      dimension = "mass";
    } else dimension = "count";
  } else if (["tbsp", "tsp", "cup"].includes(i.unit)) {
    if (d.gramsPerTablespoon) {
      amount *=
        d.gramsPerTablespoon *
        (i.unit === "tsp" ? 1 / 3 : i.unit === "cup" ? 16 : 1);
      dimension = "mass";
    } else if (
      ["oils"].includes(d.productCategoryId || "") ||
      d.id === "water"
    ) {
      amount *= i.unit === "tsp" ? 5 : i.unit === "cup" ? 240 : 15;
      dimension = "volume";
    } else return;
  } else return;
  return {
    ingredientId: d.id,
    query: d.searchTerms[0]!,
    amount,
    dimension,
    productCategoryId: d.productCategoryId,
  };
}
export function recipePurchaseRequest(
  recipe: Recipe,
  dictionary: Ingredient[],
  servings: number,
  excluded: string[],
) {
  const manual: string[] = [],
    demands = new Map<string, IngredientDemand>();
  const fallbackItems: Item[] = [];
  for (const [index, original] of scaledIngredients(
    recipe,
    servings,
  ).entries()) {
    if (excluded.includes(String(index))) continue;
    const d = dictionary.find((d) => d.id === original.ingredientId);
    const demand = d && demandFor(original, d);
    if (!demand) {
      fallbackItems.push({
        productId: `recipe:${recipe.slug}:portion:${index}`,
        quantity: 1,
        required: true,
        product: {
          id: `recipe:${recipe.slug}:portion:${index}`,
          name: d?.searchTerms[0] || original.name,
          unit: "",
          price: null,
          brand: "",
          emoji: "🛒",
          keywords: [],
        },
      });
      continue;
    }
    const key = `${demand.ingredientId}:${demand.dimension}`;
    const previous = demands.get(key);
    if (previous) previous.amount += demand.amount;
    else demands.set(key, demand);
  }
  const items: Item[] = [...demands].map(([key, demand]) => ({
    productId: `recipe:${recipe.slug}:${key}`,
    quantity: 1,
    requirement: demand,
    required: true,
    product: {
      id: `recipe:${recipe.slug}:${key}`,
      name: demand.query,
      unit: "",
      price: null,
      brand: "",
      emoji: "🛒",
      keywords: [],
    },
  }));
  return {
    title: `${recipe.title} · ${servings} порций`,
    items: [...items, ...fallbackItems],
    manual,
  };
}
export function packageMeasure(
  text: string,
): { amount: number; dimension: IngredientDemand["dimension"] } | undefined {
  const t = text
    .toLowerCase()
    .replace(/,/g, ".")
    .replace(/\u00a0/g, " ");
  // Multipacks have a single priced aggregate size, e.g. 2 × 450 г.
  const multi = t.match(
    /(\d+)\s*[xх×*]\s*(\d+(?:\.\d+)?)\s*(кг|kg|мл|ml|шт|г|g|л|l)(?=$|[\s.,/])/,
  );
  const m =
    multi || t.match(/(\d+(?:\.\d+)?)\s*(кг|kg|мл|ml|шт|г|g|л|l)(?=$|[\s.,/])/);
  if (!m) return;
  const number = multi ? Number(m[1]) * Number(m[2]) : Number(m[1]);
  const unit = multi ? m[3] : m[2];
  if (number <= 0 || !Number.isFinite(number)) return;
  return {
    amount: number * (["кг", "kg", "л", "l"].includes(unit!) ? 1000 : 1),
    dimension: ["кг", "kg", "г", "g"].includes(unit!)
      ? "mass"
      : unit === "шт"
        ? "count"
        : "volume",
  };
}
export function packagesFor(
  product: RetailProduct,
  demand: IngredientDemand,
): number | undefined {
  const size = packageMeasure(product.unit) || packageMeasure(product.name);
  if (!size || size.dimension !== demand.dimension) return;
  const n = Math.max(1, Math.ceil(demand.amount / size.amount - 1e-9));
  return n <= 99 &&
    product.available &&
    Number.isFinite(product.price) &&
    product.price >= 0 &&
    (product.stock === null || product.stock >= n)
    ? n
    : undefined;
}
const preserved =
  /маринов|консерв|пюре|чипс|соус|салат|сок|приправа|жарен|сушен|солен/;
export function ingredientProductMatches(p: RetailProduct, query: string) {
  const ingredient = normalized(query);
  if (!["сметана", "варенье"].includes(ingredient)) return true;
  const name = normalized(p.name);
  return name === ingredient || name.startsWith(ingredient + " ");
}
export function suitableProduct(p: RetailProduct, d: IngredientDemand) {
  if (!ingredientProductMatches(p, d.query)) return false;
  const name = p.name.toLowerCase().replace(/ё/g, "е");
  if (d.productCategoryId === "vegetables" && preserved.test(name))
    return false;
  if (d.ingredientId === "egg" && /перепел|шоколад|меланж/.test(name))
    return false;
  return true;
}
export function selectDemand(
  line: CompareLine,
  demand: IngredientDemand,
): CompareLine {
  if (line.error) return { ...line, demand, selected: null };
  const candidates = [
    ...new Map(
      [...(line.selected ? [line.selected] : []), ...line.alternatives].map(
        (p) => [p.id, p],
      ),
    ).values(),
  ]
    .filter((p) => suitableProduct(p, demand))
    .map((p) => ({ p, n: packagesFor(p, demand) }))
    .filter((x): x is { p: RetailProduct; n: number } => x.n !== undefined)
    .sort((a, b) => a.p.price * a.n - b.p.price * b.n);
  const first = candidates[0];
  return {
    ...line,
    demand,
    selected: first?.p || null,
    quantity: first?.n || 1,
    alternatives: candidates.map((x) => x.p),
  };
}
export function sizeOffers(
  offers: StoreComparison[],
  requests: Array<{ id: string; requirement?: IngredientDemand }>,
) {
  return offers.map((o) => ({
    ...o,
    lines: o.lines.map((l) => {
      const d = requests.find((i) => i.id === l.itemId)?.requirement;
      return d ? selectDemand(l, d) : l;
    }),
  }));
}
