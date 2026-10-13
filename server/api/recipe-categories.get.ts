import { categoriesFor } from "../utils/recipe-categories";
export default defineEventHandler(async (event) => ({
  categories: await categoriesFor(event),
}));
