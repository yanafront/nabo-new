import {
  siteOrigin,
  indexableHost,
  sitemapUrls,
  SEO_PAGE_SIZE,
  productPath,
} from "../../../shared/seo/core";
import { categoriesFor } from "../../utils/recipe-categories";
import { retailStores } from "../../../shared/yandex";
import { sitemapManifest, sitemapRecipes } from "../../utils/sitemap-data";
import { recipePage } from "../../utils/recipe-page";
import { seoService, type SeoProductReference } from "../../utils/seo-service";
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  if (!indexableHost(getRequestURL(event).hostname, config.public.seoIndexable))
    throw createError({ statusCode: 404 });
  const origin = siteOrigin(config.public.siteUrl),
    file = getRouterParam(event, "file") || "";
  const recipeCategories = await categoriesFor(event);
  let entries: Array<{ loc: string; lastmod?: string; image?: string }>;
  if (file === "static.xml")
    entries = [
      "/",
      "/recipes",
      "/products",
      "/stores",
      "/delivery",
      ...(
        await Promise.all(
          recipeCategories.map(async (c) =>
            (await recipePage(event, { category: c.id, limit: 1 })).total > 0
              ? `/recipes/category/${c.id}`
              : null,
          ),
        )
      ).filter((path): path is string => !!path),
      ...retailStores.map((s) => `/stores/${s.id}`),
    ].map((path) => ({ loc: origin + path }));
  else {
    const match = file.match(/^(recipes|products)-([1-9]\d*)\.xml$/);
    if (!match) throw createError({ statusCode: 404 });
    const type = match[1] as "recipes" | "products",
      page = Number(match[2]);
    const manifest = await sitemapManifest(event);
    if (
      !Number.isSafeInteger(page) ||
      page > Math.ceil(manifest[type] / SEO_PAGE_SIZE)
    )
      throw createError({ statusCode: 404 });
    entries =
      type === "recipes"
        ? (await sitemapRecipes(event, page)).map((r) => ({
            loc: origin + `/recipes/${encodeURIComponent(r.slug)}`,
            image: r.image ? new URL(r.image, origin).href : undefined,
          }))
        : (
            (
              await seoService(event, "/api/seo/products", {
                offset: (page - 1) * SEO_PAGE_SIZE,
                limit: SEO_PAGE_SIZE,
              })
            ).items as SeoProductReference[]
          ).map((p) => ({
            loc: origin + productPath(p.storeId, p.id),
            lastmod: p.updatedAt,
            image: p.image ? new URL(p.image, origin).href : undefined,
          }));
  }
  setHeader(event, "Content-Type", "application/xml; charset=utf-8");
  setHeader(event, "Cache-Control", "public,max-age=300");
  return sitemapUrls(entries);
});
