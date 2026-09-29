import { ingredients as commonIngredients } from "./ingredients";
import {
  normalized,
  recipeCategories,
  type Ingredient,
  type Recipe,
  type RecipeCatalog,
} from "./model";
const hash = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36);
};
const category = (title: string) => {
  const t = normalized(title);
  if (/суп|борщ|щи$|бульон|солянк|рассольник|окрошк|харчо|гаспачо/.test(t))
    return "soups";
  if (/салат|винегрет/.test(t)) return "salads";
  if (/паста|спагетти|фетуч|лазанья|макарон|карбонар/.test(t)) return "pasta";
  if (/сырник|омлет|каша|яичниц|панкейк|завтрак|тортилья/.test(t))
    return "breakfast";
  if (
    /(^| )торт( |$)|десерт|морожен|пудинг|мусс|тирамису|желе|крем брюле/.test(t)
  )
    return "desserts";
  if (
    /пирог|печенье|булоч|хлеб|выпечк|кекс|пахлав|блин|бурек|чапати|баурсак|боорсок|лангош/.test(
      t,
    )
  )
    return "baking";
  if (/тахдиг|пюре|гречк|гарнир|полента/.test(t)) return "sides";
  return "mains";
};
export function migrateLegacy(input: any): RecipeCatalog {
  if (!Array.isArray(input?.recipes)) throw new Error("Нет массива recipes");
  const dictionary = new Map(
    commonIngredients.map((i) => [i.id, structuredClone(i)]),
  );
  const aliases = new Map(
    commonIngredients.flatMap((i) =>
      [i.name, ...i.aliases].map((n) => [normalized(n), i.id] as const),
    ),
  );
  const recipes: Recipe[] = input.recipes.map((raw: any) => {
    const title = raw.name?.ru;
    if (!title || !Number.isFinite(raw.baseServings) || raw.baseServings <= 0)
      throw new Error("Неверный исходный рецепт");
    const rows = raw.ingredients.map((row: any) => {
      const name = row.name?.ru?.trim();
      if (!name) throw new Error("Пустой ингредиент");
      const key = normalized(name);
      const id = aliases.get(key) || `ingredient-${hash(key)}`;
      if (!dictionary.has(id))
        dictionary.set(id, {
          id,
          name,
          aliases: [name],
          searchTerms: [name],
          pantry: false,
          common: false,
        });
      const entry = dictionary.get(id)!;
      return {
        ingredientId: id,
        name,
        quantity: row.quantity ?? 0,
        unit: row.unit,
        categoryId: entry.productCategoryId,
        ...(row.quantity === null
          ? { unquantified: true, optional: true }
          : {}),
        ...(row.unit === "g" && row.quantity !== null
          ? { weightGrams: row.quantity }
          : {}),
        ...(row.unit === "kg" && row.quantity !== null
          ? { weightGrams: row.quantity * 1000 }
          : {}),
      };
    });
    const main = rows.filter(
      (i: any) => !dictionary.get(i.ingredientId)?.pantry,
    );
    const score = Math.round(
      (100 *
        main.filter((i: any) => dictionary.get(i.ingredientId)?.common)
          .length) /
        Math.max(1, main.length),
    );
    const tags: string[] = [];
    const categories = new Set(
      rows.map((i: any) => dictionary.get(i.ingredientId)?.productCategoryId),
    );
    for (const c of ["chicken", "meat", "fish"])
      if (categories.has(c)) tags.push(c);
    if (raw.baseServings >= 4) tags.push("family");
    // Budget is an ingredient-based collection, never a price promise.
    if (
      score >= 85 &&
      main.length <= 8 &&
      !categories.has("meat") &&
      !categories.has("fish")
    )
      tags.push("budget");
    return {
      id: `unitools:${raw.slug}`,
      slug: raw.slug,
      title,
      description: raw.summary?.ru || "",
      categoryId: category(title),
      tags,
      cookingTime: raw.prepMinutes + raw.cookMinutes,
      servings: raw.baseServings,
      image: raw.photo?.url || undefined,
      imageAttribution: raw.photo
        ? `${raw.photo.author} · ${raw.photo.license}`
        : undefined,
      ingredients: rows,
      source: "UniTools",
      sourceId: raw.slug,
      sourceUrl: input.source,
      license: input.license,
      isActive: true,
      shopabilityScore: score,
    };
  });
  return validateCatalog({
    version: 2,
    ingredients: [...dictionary.values()],
    recipes,
  });
}
export function validateCatalog(value: unknown): RecipeCatalog {
  const c = value as RecipeCatalog;
  if (
    c?.version !== 2 ||
    !Array.isArray(c.ingredients) ||
    !Array.isArray(c.recipes)
  )
    throw new Error("Ожидается RecipeCatalog version 2");
  const ids = new Set<string>(),
    recipes = new Set<string>(),
    slugs = new Set<string>();
  const safe = (s: unknown) => typeof s === "string" && !!s.trim();
  const url = (s: unknown) =>
    s === undefined || (typeof s === "string" && /^https:\/\//.test(s));
  for (const i of c.ingredients) {
    if (
      !safe(i.id) ||
      !safe(i.name) ||
      ids.has(i.id) ||
      !Array.isArray(i.aliases) ||
      !i.aliases.every(safe) ||
      !Array.isArray(i.searchTerms) ||
      !i.searchTerms.length ||
      !i.searchTerms.every(safe) ||
      typeof i.pantry !== "boolean" ||
      typeof i.common !== "boolean"
    )
      throw new Error("Неверный или повторный ингредиент");
    ids.add(i.id);
  }
  const units = new Set([
    "g",
    "kg",
    "ml",
    "l",
    "piece",
    "clove",
    "tbsp",
    "tsp",
    "cup",
    "pinch",
    "toTaste",
    "slice",
    "sprig",
    "bunch",
  ]);
  for (const r of c.recipes) {
    if (
      !safe(r.id) ||
      recipes.has(r.id) ||
      !safe(r.title) ||
      !/^[a-z0-9][a-z0-9-]*$/.test(r.slug) ||
      slugs.has(r.slug) ||
      !Number.isInteger(r.servings) ||
      r.servings < 1 ||
      r.servings > 100 ||
      !recipeCategories.some((x) => x.id === r.categoryId) ||
      !Array.isArray(r.tags) ||
      !r.tags.every(safe) ||
      !safe(r.source) ||
      !safe(r.sourceId) ||
      typeof r.isActive !== "boolean" ||
      !url(r.image) ||
      !url(r.sourceUrl)
    )
      throw new Error(`Неверный рецепт: ${r.slug}`);
    if (
      !Array.isArray(r.ingredients) ||
      !r.ingredients.length ||
      r.ingredients.length > 50
    )
      throw new Error("Неверный состав");
    for (const i of r.ingredients)
      if (
        !ids.has(i.ingredientId) ||
        !safe(i.name) ||
        !Number.isFinite(i.quantity) ||
        i.quantity < 0 ||
        (!i.unquantified && i.quantity === 0) ||
        !units.has(i.unit) ||
        (i.weightGrams !== undefined &&
          (!Number.isFinite(i.weightGrams) || i.weightGrams <= 0))
      )
        throw new Error(`Неверный ингредиент: ${r.slug}`);
    if (r.nutrition) {
      const n = r.nutrition;
      if (
        !["serving", "recipe", "100g"].includes(n.basis) ||
        !["source", "calculated"].includes(n.calculationType) ||
        !safe(n.source) ||
        ![n.calories, n.protein, n.fat, n.carbs].every(
          (v) => Number.isFinite(v) && v >= 0,
        )
      )
        throw new Error("Неизвестная база КБЖУ");
    }
    if (
      r.yieldGrams !== undefined &&
      (!Number.isFinite(r.yieldGrams) || r.yieldGrams <= 0)
    )
      throw new Error("Неверный выход блюда");
    if (
      r.cookingTime !== undefined &&
      (!Number.isFinite(r.cookingTime) || r.cookingTime < 0)
    )
      throw new Error("Неверное время");
    if (
      r.instructions &&
      (!Array.isArray(r.instructions) ||
        !r.instructions.every((s) => safe(s.text)))
    )
      throw new Error("Неверные шаги");
    const main = r.ingredients.filter(
      (i) => !c.ingredients.find((x) => x.id === i.ingredientId)!.pantry,
    );
    r.shopabilityScore = Math.round(
      (100 *
        main.filter(
          (i) => c.ingredients.find((x) => x.id === i.ingredientId)!.common,
        ).length) /
        Math.max(1, main.length),
    );
    recipes.add(r.id);
    slugs.add(r.slug);
  }
  return c;
}
/** RFC4180-style CSV. Nested arrays and nutrition are JSON cells, never free-text guessing. */
export function parseRecipeCsv(
  text: string,
  ingredients: Ingredient[],
): RecipeCatalog {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let n = 0; n < text.length; n++) {
    const ch = text[n];
    if (ch === '"') {
      if (quoted && text[n + 1] === '"') {
        cell += '"';
        n++;
      } else if (
        (!quoted && cell) ||
        (quoted && text[n + 1] && ![",", "\r", "\n"].includes(text[n + 1]!))
      ) {
        throw new Error("Неверные кавычки CSV");
      } else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" && !quoted) {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (quoted) throw new Error("Незакрытая кавычка CSV");
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  const header = rows.shift()?.map((s) => s.replace(/^\uFEFF/, ""));
  if (!header) throw new Error("Пустой CSV");
  const recipes = rows
    .filter((r) => r.some(Boolean))
    .map((row) => {
      if (row.length !== header.length)
        throw new Error("Число колонок CSV не совпадает");
      const r: any = Object.fromEntries(header.map((key, n) => [key, row[n]]));
      for (const k of ["servings", "cookingTime", "yieldGrams"])
        if (r[k]) r[k] = Number(r[k]);
        else delete r[k];
      for (const k of ["ingredients", "tags", "instructions", "nutrition"])
        if (r[k]) r[k] = JSON.parse(r[k]);
        else delete r[k];
      r.isActive = r.isActive === "true";
      for (const k of ["image", "sourceUrl"]) if (!r[k]) delete r[k];
      return r;
    });
  return validateCatalog({ version: 2, ingredients, recipes });
}
export interface RecipeSourceAdapter<T> {
  readonly name: string;
  normalize(input: T): RecipeCatalog;
}
export const jsonRecipeAdapter: RecipeSourceAdapter<unknown> = {
  name: "nabo-json",
  normalize: validateCatalog,
};
export const legacyRecipeAdapter: RecipeSourceAdapter<unknown> = {
  name: "unitools-migration",
  normalize: migrateLegacy,
};
