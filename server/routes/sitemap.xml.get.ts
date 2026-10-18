import {
  siteOrigin,
  xml,
  SEO_PAGE_SIZE,
  indexableHost,
} from "../../shared/seo/core";
import { sitemapManifest } from "../utils/sitemap-data";
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  if (!indexableHost(getRequestURL(event).hostname, config.public.seoIndexable))
    throw createError({ statusCode: 404 });
  const origin = siteOrigin(config.public.siteUrl),
    manifest = await sitemapManifest(event);
  const urls = [
    `${origin}/sitemaps/static.xml`,
    ...["recipes", "products"].flatMap((type) =>
      Array.from(
        {
          length: Math.ceil(
            manifest[type as "recipes" | "products"] / SEO_PAGE_SIZE,
          ),
        },
        (_, i) => `${origin}/sitemaps/${type}-${i + 1}.xml`,
      ),
    ),
  ];
  setHeader(event, "Content-Type", "application/xml; charset=utf-8");
  setHeader(event, "Cache-Control", "public,max-age=300");
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((loc) => `<sitemap><loc>${xml(loc)}</loc></sitemap>`).join("")}</sitemapindex>`;
});
