import { recipePage } from "../../utils/recipe-page";
export default defineEventHandler(async (event) => {
  const page = Number(getQuery(event).page || 1);
  if (!Number.isInteger(page) || page < 1 || page > 100000)
    throw createError({ statusCode: 400 });
  return recipePage(event, { offset: (page - 1) * 24, limit: 24 });
});
