import {
  recipeCategories,
  ingredientAmount,
  perServing,
  scaledIngredients,
  type Recipe,
} from "../recipe/model";
import { providerName, type RetailProduct } from "../yandex";
export const SEO_PAGE_SIZE = 2000;
export const PRIMARY_SITE_ORIGIN = "https://www.nabo.by";
export function indexableHost(hostname: string, enabled: unknown) {
  return (
    enabled !== false &&
    enabled !== "false" &&
    ["www.nabo.by", "localhost", "127.0.0.1", "[::1]"].includes(
      hostname.toLowerCase(),
    )
  );
}
export function siteOrigin(value: string) {
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol))
    throw new Error("Invalid public site URL");
  // A stale deployment variable must never make a Vercel alias canonical.
  if (
    url.hostname === "nabo.by" ||
    url.hostname === "www.nabo.by" ||
    url.hostname.endsWith(".vercel.app")
  )
    return PRIMARY_SITE_ORIGIN;
  return url.origin;
}
export function productPath(storeId: string, id: string) {
  return `/product/${encodeURIComponent(storeId)}/${encodeURIComponent(id)}`;
}
export function seoPolicy(path: string, query: Record<string, unknown> = {}) {
  const privatePage = /^\/(basket|saved|account|admin|l)(\/|$)/.test(path);
  const paginated =
    path === "/recipes" ||
    /^\/recipes\/category\//.test(path) ||
    /^\/stores\//.test(path) ||
    path === "/products" ||
    path === "/delivery";
  const page = Number(query.page || 1);
  const ignored = [
    "name",
    "servings",
    "add",
    "replace",
    "store",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "yclid",
    "gclid",
  ];
  const filtered = Object.keys(query).some(
    (key) => !ignored.includes(key) && !(key === "page" && paginated),
  );
  const invalidPage =
    query.page !== undefined &&
    (!Number.isInteger(page) || page < 1 || page > 100000);
  return {
    index: !privatePage && !filtered && !invalidPage,
    canonicalPath:
      path +
      (paginated && Number.isInteger(page) && page > 1 ? `?page=${page}` : ""),
  };
}
export function jsonLd(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
export function recipeSchema(
  recipe: Recipe,
  origin: string,
  servings = recipe.servings,
  categoryTitle?: string,
) {
  origin = siteOrigin(origin);
  const url = origin + `/recipes/${encodeURIComponent(recipe.slug)}`;
  const nutrition = perServing(recipe);
  return {
    "@type": "Recipe",
    "@id": url + "#recipe",
    url,
    name: recipe.title,
    description: recipe.description,
    image: recipe.image ? [new URL(recipe.image, origin).href] : undefined,
    recipeCategory:
      categoryTitle ||
      recipeCategories.find((c) => c.id === recipe.categoryId)?.title,
    recipeYield: `${servings} порций`,
    totalTime: recipe.cookingTime ? `PT${recipe.cookingTime}M` : undefined,
    recipeIngredient: scaledIngredients(recipe, servings).map((i) =>
      `${ingredientAmount(i)} ${i.name}`.trim(),
    ),
    recipeInstructions: recipe.instructions?.map((s, i) => ({
      "@type": "HowToStep",
      text: s.text,
      url: url + `#step-${i + 1}`,
    })),
    nutrition: nutrition
      ? {
          "@type": "NutritionInformation",
          calories: `${nutrition.calories} kcal`,
          proteinContent: `${nutrition.protein} g`,
          fatContent: `${nutrition.fat} g`,
          carbohydrateContent: `${nutrition.carbs} g`,
        }
      : undefined,
    isBasedOn: recipe.sourceUrl,
  };
}
export function productSchema(product: RetailProduct, origin: string) {
  origin = siteOrigin(origin);
  return {
    "@type": "Product",
    "@id": origin + productPath(product.storeId, product.id) + "#product",
    name: product.name,
    image: product.image ? new URL(product.image, origin).href : undefined,
    description: product.description || `${product.name}, ${product.unit}`,
    sku: product.id,
    offers:
      Number.isFinite(product.price) && product.price >= 0
        ? {
            "@type": "Offer",
            price: product.price,
            priceCurrency: "BYN",
            availability: `https://schema.org/${product.available ? "InStock" : "OutOfStock"}`,
            url:
              product.externalUrl ||
              origin + productPath(product.storeId, product.id),
            seller: {
              "@type": "Organization",
              name: providerName(product.storeId),
            },
          }
        : undefined,
  };
}
export function breadcrumb(
  origin: string,
  entries: Array<{ name: string; path: string }>,
) {
  origin = siteOrigin(origin);
  return {
    "@type": "BreadcrumbList",
    itemListElement: entries.map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: e.name,
      item: origin + e.path,
    })),
  };
}
export function xml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
}
export function sitemapUrls(
  entries: Array<{ loc: string; lastmod?: string; image?: string }>,
) {
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${entries.map((e) => `<url><loc>${xml(e.loc)}</loc>${e.lastmod ? `<lastmod>${xml(e.lastmod)}</lastmod>` : ""}${e.image ? `<image:image><image:loc>${xml(e.image)}</image:loc></image:image>` : ""}</url>`).join("")}</urlset>`;
}
