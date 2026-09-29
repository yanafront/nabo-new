import { readFile, writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import {
  migrateLegacy,
  validateCatalog,
  parseRecipeCsv,
} from "../shared/recipe/import";
const [mode, input, output = "data/recipe-catalog.json", dictionary] =
  process.argv.slice(2);
if (!input || !["legacy", "json", "csv"].includes(mode || ""))
  throw new Error(
    "Usage: npm run recipes:import -- legacy|json|csv input [output] [ingredient-dictionary.json]",
  );
const raw = await readFile(resolve(input), "utf8");
const result =
  mode === "legacy"
    ? migrateLegacy(JSON.parse(raw))
    : mode === "json"
      ? validateCatalog(JSON.parse(raw))
      : parseRecipeCsv(
          raw,
          JSON.parse(
            await readFile(
              resolve(dictionary || "data/ingredients.json"),
              "utf8",
            ),
          ),
        );
// Validate the entire import before atomically replacing the snapshot.
const path = resolve(output),
  temp = path + ".tmp";
await writeFile(temp, JSON.stringify(result, null, 2) + "\n");
await rename(temp, path);
console.log(
  `Imported ${result.recipes.length} recipes, ${result.ingredients.length} ingredients to ${output}`,
);
console.log(
  `Nutrition available: ${result.recipes.filter((r) => r.nutrition).length}; other recipes explicitly display unavailable.`,
);
