/** Curated Russian-language UniTools v2 import, with explicit provenance. */
import { readFile, writeFile, rename } from "node:fs/promises";
import { migrateLegacy, validateCatalog } from "../shared/recipe/import";
const [
  input = "data/recipe-source-familiar.json",
  output = "data/recipe-catalog.json",
] = process.argv.slice(2);
const source = JSON.parse(await readFile(input, "utf8"));
const catalog = migrateLegacy(source);
const categories: Record<string, string> = {
  "horiatiki-salata": "salads",
  kholodnik: "soups",
  saltibarsciai: "soups",
  lohikeitto: "soups",
  erwtensoep: "soups",
  kulajda: "soups",
  cepelinai: "mains",
  colcannon: "sides",
  "schwaebischer-kartoffelsalat": "salads",
};
const titles: Record<string, string> = {
  "horiatiki-salata": "Греческий салат",
  kholodnik: "Холодник",
  saltibarsciai: "Литовский холодник",
  lohikeitto: "Сливочный суп с лососем",
  frikadeller: "Датские мясные котлеты",
  "pierogi-ruskie": "Вареники с картофелем и творогом",
  "schwaebischer-kartoffelsalat": "Картофельный салат",
  colcannon: "Картофельное пюре с капустой",
  kugelis: "Картофельная запеканка",
  erwtensoep: "Гороховый суп",
  appelkaka: "Шведский яблочный пирог",
  kulajda: "Грибной суп со сметаной",
  bigos: "Бигос с мясом и капустой",
};
for (const recipe of catalog.recipes) {
  const raw = source.recipes.find((r: any) => r.slug === recipe.slug);
  if (titles[recipe.slug]) recipe.title = titles[recipe.slug]!;
  if (categories[recipe.slug]) recipe.categoryId = categories[recipe.slug]!;
  if (raw.country === "BY") recipe.tags.push("belarusian");
}
// The checked source snapshot is part of the repo; no recipe-site request at runtime.
catalog.ingredients = catalog.ingredients.filter((i) =>
  catalog.recipes.some((r) =>
    r.ingredients.some((row) => row.ingredientId === i.id),
  ),
);
validateCatalog(catalog);
await writeFile(output + ".tmp", JSON.stringify(catalog, null, 2) + "\n");
await rename(output + ".tmp", output);
console.log(
  JSON.stringify({
    recipes: catalog.recipes.length,
    photos: catalog.recipes.filter((r) => r.image).length,
    nutrition: catalog.recipes.filter((r) => r.nutrition).length,
  }),
);
