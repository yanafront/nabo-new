import { seoPolicy } from "../../shared/seo/core";
import { recipeCategories } from "../../shared/recipe/model";
export default defineEventHandler((event) => {
  const url = getRequestURL(event),
    config = useRuntimeConfig(event);
  if (
    !config.public.seoIndexable ||
    !seoPolicy(url.pathname, Object.fromEntries(url.searchParams)).index ||
    (url.pathname.startsWith("/api/") && url.pathname !== "/api/product-image")
  )
    setHeader(event, "X-Robots-Tag", "noindex, follow");
  if (
    event.method === "GET" &&
    url.pathname === "/recipes" &&
    !url.searchParams.get("q") &&
    recipeCategories.some((c) => c.id === url.searchParams.get("category"))
  ) {
    const category = url.searchParams.get("category")!;
    url.searchParams.delete("category");
    return sendRedirect(
      event,
      `/recipes/category/${category}${url.searchParams.size ? "?" + url.searchParams : ""}`,
      301,
    );
  }
  if (
    event.method === "GET" &&
    url.pathname.length > 1 &&
    url.pathname.endsWith("/")
  )
    return sendRedirect(
      event,
      url.pathname.replace(/\/+$/, "") + url.search,
      301,
    );
});
