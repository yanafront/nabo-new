import { recipeDetail } from "../../utils/recipe-detail";
export default defineEventHandler((event) =>
  recipeDetail(event, getRouterParam(event, "slug") || ""),
);
