import { siteOrigin, indexableHost } from "../../shared/seo/core";
export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event),
    origin = siteOrigin(config.public.siteUrl);
  setHeader(event, "Content-Type", "text/plain; charset=utf-8");
  setHeader(event, "Cache-Control", "public, max-age=300");
  if (!indexableHost(getRequestURL(event).hostname, config.public.seoIndexable))
    // Crawlers must reach the noindex response to remove previously indexed aliases.
    return "User-agent: *\nAllow: /\nDisallow: /api/\n";
  return `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin/\nDisallow: /auth/\nDisallow: /__nuxt_error\nAllow: /api/product-image\n\nUser-agent: Yandex\nAllow: /\nDisallow: /api/\nDisallow: /admin/\nDisallow: /auth/\nDisallow: /__nuxt_error\nAllow: /api/product-image\nClean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&gclid&yclid\n\nSitemap: ${origin}/sitemap.xml\n`;
});
