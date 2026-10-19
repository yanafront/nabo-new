import { publicPrices } from "../../utils/public-prices";
import { productTopic } from "../../../shared/seo/topics";
import { seoService } from "../../utils/seo-service";
import { recipePage } from "../../utils/recipe-page";
export default defineEventHandler(async (event) => {
  const topic = productTopic(getRouterParam(event, "slug"));
  if (!topic) throw createError({ statusCode: 404 });
  const page = Number(getQuery(event).page || 1);
  if (!Number.isInteger(page) || page < 1 || page > 100000)
    throw createError({ statusCode: 400 });
  const [products, recipes] = await Promise.all([
    seoService(event, "/api/seo/products", {
      q: topic.prefix,
      offset: (page - 1) * 24,
      limit: 24,
    }),
    recipePage(event, { q: topic.query, limit: 6 }),
  ]);
  const items = products.items.filter((p: { name: string }) =>
    p.name.toLocaleLowerCase("ru").startsWith(topic.prefix),
  );
  return {
    prices: await publicPrices(event, items),
    products: { items, total: items.length ? products.total : 0 },
    recipes: recipes.recipes,
  };
});
