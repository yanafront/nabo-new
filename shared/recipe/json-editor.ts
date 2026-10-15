import {
  recipeCategories,
  type Recipe,
  type Ingredient,
  type RecipeIngredient,
} from "./model";
import type { RecipeDocument } from "./editor";
/** Full editable document. Values are an example, not verified nutritional data. */
export const recipeJsonExample = {
  recipe: {
    id: "",
    slug: "omlet-s-pomidorami",
    title: "Омлет с помидорами",
    categoryId: "breakfast",
    description: "Быстрый завтрак на двоих",
    image: "",
    imageAttribution: "",
    tags: ["quick20", "easy"],
    servings: 2,
    cookingTime: 15,
    difficulty: "easy",
    yieldGrams: 500,
    nutrition: {
      calories: 240,
      protein: 16,
      fat: 16,
      carbs: 8,
      basis: "serving",
      calculationType: "calculated",
      source: "Пример расчёта — замените проверенными данными",
    },
    ingredients: [
      {
        ingredientId: "eggs",
        name: "Яйца",
        quantity: 4,
        unit: "piece",
        weightGrams: 200,
        categoryId: "eggs",
        searchQuery: "Яйца куриные",
        exactName: "",
        exactUnit: "10 шт",
        optional: false,
        unquantified: false,
      } satisfies Required<RecipeIngredient>,
      {
        ingredientId: "tomatoes",
        name: "Помидоры",
        quantity: 200,
        unit: "g",
        searchQuery: "Помидоры",
      },
      {
        ingredientId: "milk",
        name: "Молоко",
        quantity: 100,
        unit: "ml",
        searchQuery: "Молоко 3.2%",
      },
    ],
    instructions: [
      { text: "Нарежьте помидоры." },
      {
        text: "Взбейте яйца с молоком. Добавьте помидоры и готовьте под крышкой до готовности.",
      },
    ],
    source: "Nabo",
    sourceId: "",
    sourceUrl: "",
    license: "",
    isActive: true,
    shopabilityScore: 100,
  },
  ingredients: [
    {
      id: "eggs",
      name: "Яйца",
      aliases: ["Яйцо куриное"],
      productCategoryId: "eggs",
      searchTerms: ["Яйца куриные"],
      pantry: false,
      common: true,
      gramsPerPiece: 50,
      gramsPerTablespoon: 15,
      density: 1,
    } satisfies Required<Ingredient>,
    {
      id: "tomatoes",
      name: "Помидоры",
      aliases: ["Томаты"],
      searchTerms: ["Помидоры"],
      pantry: false,
      common: true,
    },
    {
      id: "milk",
      name: "Молоко",
      aliases: [],
      searchTerms: ["Молоко 3.2%"],
      pantry: false,
      common: true,
      density: 1.03,
    },
  ],
} satisfies { recipe: Required<Recipe>; ingredients: Ingredient[] };
const units = [
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
];
const fail = (path: string, reason: string): never => {
  throw new Error(`${path}: ${reason}`);
};
function object(value: unknown, path: string): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(path, "ожидается объект");
  return value as Record<string, any>;
}
function text(
  value: unknown,
  path: string,
  max: number,
  empty = false,
): string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (!empty && !value.trim())
  )
    fail(
      path,
      `укажите строку${empty ? "" : " без пустого значения"} длиной до ${max} символов`,
    );
  return (value as string).trim();
}
function number(
  value: unknown,
  path: string,
  min: number,
  max: number,
  integer = false,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    fail(path, `укажите ${integer ? "целое " : ""}число от ${min} до ${max}`);
  return value as number;
}
function array(value: unknown, path: string, min: number, max: number): any[] {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    fail(path, `нужно от ${min} до ${max} элементов`);
  return value as any[];
}
function flag(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") fail(path, "укажите true или false");
  return value as boolean;
}
function url(value: unknown, path: string) {
  if (value === "") return "";
  const result = text(value, path, 4000);
  try {
    const parsed = new URL(result);
    if (parsed.protocol !== "https:") fail(path, "нужна ссылка https://");
  } catch {
    fail(path, "нужна корректная ссылка https://");
  }
  return result;
}
/** Accept a compact recipe or an exported document, while preserving explicit retail queries. */
export function parseRecipeJson(
  input: string,
  categories = recipeCategories,
): RecipeDocument {
  if (new TextEncoder().encode(input).length > 250 * 1024)
    fail("JSON", "файл больше 250 КБ");
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    fail("JSON", "проверьте кавычки, запятые и скобки");
  }
  const root = object(parsed, "JSON");
  const wrapped = Object.hasOwn(root, "recipe");
  const raw = wrapped ? object(root.recipe, "recipe") : root;
  const slug = text(raw.slug, "slug", 100);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    fail("slug", "используйте латинские буквы, цифры и дефисы");
  const recipe: Record<string, any> = {
    ...raw,
    slug,
    title: text(raw.title, "title", 200),
    id: text((raw.id === "" ? undefined : raw.id) ?? `nabo:${slug}`, "id", 160),
    source: text(raw.source ?? "Nabo", "source", 200),
    sourceId: text(
      (raw.sourceId === "" ? undefined : raw.sourceId) ?? slug,
      "sourceId",
      200,
    ),
    categoryId: text(raw.categoryId, "categoryId", 50),
    servings: number(raw.servings, "servings", 1, 30, true),
    isActive: flag(raw.isActive ?? true, "isActive"),
    shopabilityScore: number(
      raw.shopabilityScore ?? 100,
      "shopabilityScore",
      0,
      100,
    ),
    tags: array(raw.tags ?? [], "tags", 0, 30).map((tag, i) =>
      text(tag, `tags[${i}]`, 100),
    ),
  };
  if (!categories.some((category) => category.id === recipe.categoryId))
    fail("categoryId", "выберите существующую категорию рецептов");
  for (const [key, limit] of [
    ["description", 5000],
    ["imageAttribution", 500],
    ["license", 200],
  ] as const)
    if (raw[key] !== undefined) recipe[key] = text(raw[key], key, limit, true);
  for (const key of ["image", "sourceUrl"])
    if (raw[key] !== undefined) recipe[key] = url(raw[key], key);
  if (raw.cookingTime !== undefined)
    recipe.cookingTime = number(raw.cookingTime, "cookingTime", 0, 10080);
  if (raw.yieldGrams !== undefined)
    recipe.yieldGrams = number(raw.yieldGrams, "yieldGrams", 1, 100000);
  if (
    raw.difficulty !== undefined &&
    !["easy", "medium", "hard"].includes(raw.difficulty)
  )
    fail("difficulty", "укажите easy, medium или hard");
  recipe.ingredients = array(raw.ingredients, "ingredients", 1, 20).map(
    (value, index) => {
      const path = `ingredients[${index}]`;
      const row = object(value, path);
      const unit = text(row.unit, `${path}.unit`, 20);
      if (!units.includes(unit))
        fail(`${path}.unit`, "неизвестная единица измерения");
      const result: Record<string, any> = {
        ...row,
        ingredientId: text(
          row.ingredientId ?? `ingredient-${index + 1}`,
          `${path}.ingredientId`,
          160,
        ),
        name: text(row.name, `${path}.name`, 200),
        searchQuery: text(row.searchQuery, `${path}.searchQuery`, 160),
        quantity: number(row.quantity, `${path}.quantity`, 0, 100000),
        unit,
      };
      for (const key of ["optional", "unquantified", "scalable"])
        if (row[key] !== undefined) flag(row[key], `${path}.${key}`);
      if (row.quantity === 0 && row.unquantified !== true)
        fail(
          `${path}.quantity`,
          "нулевое количество допустимо только с unquantified: true",
        );
      if (row.weightGrams !== undefined)
        result.weightGrams = number(
          row.weightGrams,
          `${path}.weightGrams`,
          0.001,
          100000,
        );
      if (row.exactName !== undefined)
        result.exactName = text(row.exactName, `${path}.exactName`, 500, true);
      if (row.exactUnit !== undefined)
        result.exactUnit = text(row.exactUnit, `${path}.exactUnit`, 80, true);
      if (row.categoryId !== undefined)
        result.categoryId = text(
          row.categoryId,
          `${path}.categoryId`,
          160,
          true,
        );
      return result;
    },
  );
  recipe.instructions = array(
    raw.instructions ?? [],
    "instructions",
    0,
    100,
  ).map((step, i) => ({
    text: text(
      typeof step === "string" ? step : object(step, `instructions[${i}]`).text,
      `instructions[${i}].text`,
      5000,
    ),
  }));
  if (raw.nutrition !== undefined) {
    const n = object(raw.nutrition, "nutrition");
    if (!["serving", "recipe", "100g"].includes(n.basis))
      fail("nutrition.basis", "укажите serving, recipe или 100g");
    if (!["source", "calculated"].includes(n.calculationType))
      fail("nutrition.calculationType", "укажите source или calculated");
    const nutrition: Record<string, any> = {
      ...n,
      source: text(n.source, "nutrition.source", 500),
    };
    for (const key of ["calories", "protein", "fat", "carbs"])
      nutrition[key] = number(n[key], `nutrition.${key}`, 0, 100000);
    if (n.basis === "100g" && recipe.yieldGrams === undefined)
      fail(
        "yieldGrams",
        "для КБЖУ на 100 г укажите вес готового блюда, чтобы показать КБЖУ на порцию",
      );
    recipe.nutrition = nutrition;
  }
  const generated = [
    ...new Map(
      recipe.ingredients.map((row: any) => [
        row.ingredientId,
        {
          id: row.ingredientId,
          name: row.name,
          aliases: [],
          searchTerms: [row.searchQuery],
          pantry: false,
          common: true,
        },
      ]),
    ).values(),
  ];
  const ingredients = array(
    wrapped ? (root.ingredients ?? generated) : generated,
    "ingredients dictionary",
    1,
    20,
  ).map((value, index) => {
    const path = `dictionary[${index}]`;
    const row = object(value, path);
    const entry: Record<string, any> = {
      ...row,
      id: text(row.id, `${path}.id`, 160),
      name: text(row.name, `${path}.name`, 200),
      aliases: array(row.aliases ?? [], `${path}.aliases`, 0, 30).map(
        (alias, i) => text(alias, `${path}.aliases[${i}]`, 200, true),
      ),
      searchTerms: array(row.searchTerms, `${path}.searchTerms`, 1, 10).map(
        (term, i) => text(term, `${path}.searchTerms[${i}]`, 160),
      ),
      pantry: flag(row.pantry ?? false, `${path}.pantry`),
      common: flag(row.common ?? true, `${path}.common`),
    };
    if (row.productCategoryId !== undefined)
      entry.productCategoryId = text(
        row.productCategoryId,
        `${path}.productCategoryId`,
        160,
        true,
      );
    for (const key of ["gramsPerPiece", "gramsPerTablespoon", "density"])
      if (row[key] !== undefined)
        entry[key] = number(row[key], `${path}.${key}`, 0.001, 100000);
    return entry;
  });
  const ids = new Set(ingredients.map((row) => row.id));
  if (ids.size !== ingredients.length)
    fail("dictionary", "идентификаторы ингредиентов должны быть уникальны");
  if (recipe.ingredients.some((row: any) => !ids.has(row.ingredientId)))
    fail("ingredientId", "ингредиент отсутствует в словаре документа");
  const document = {
    recipe: recipe as Recipe,
    ingredients: ingredients as Ingredient[],
  };
  if (
    new TextEncoder().encode(
      JSON.stringify({ document, revision: 0, publish: true }),
    ).length >
    256 * 1024
  )
    fail("JSON", "документ после обработки превышает 256 КБ");
  return document;
}
