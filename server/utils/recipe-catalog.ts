import snapshot from "../../data/recipe-catalog.json";
import type { RecipeCatalog } from "../../shared/recipe/model";
// Frontend reads this internal snapshot, never a provider's live API.
export const recipeCatalog = snapshot as RecipeCatalog;
