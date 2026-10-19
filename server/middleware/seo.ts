import {
  seoPolicy,
  indexableHost,
  PRIMARY_SITE_ORIGIN,
} from "../../shared/seo/core";
import { recipeCategories as defaultCategories } from "../../shared/recipe/model";
import { apexIsServing } from "../utils/canonical-host";
import { categoriesFor } from "../utils/recipe-categories";
export default defineEventHandler(async (event) => {
  const url = getRequestURL(event),
    config = useRuntimeConfig(event);
  const privatePage = /^\/(basket|saved|account|admin)(\/|$)/.test(
    url.pathname,
  );
  const personalizedPage =
    getCookie(event, "nabo-session") &&
    !url.pathname.startsWith("/api/") &&
    !/\.[a-z0-9]+$/i.test(url.pathname);
  if (privatePage || personalizedPage)
    setHeader(event, "Cache-Control", "private, no-store");
  if (
    !indexableHost(url.hostname, config.public.seoIndexable) ||
    !seoPolicy(url.pathname, Object.fromEntries(url.searchParams)).index ||
    (url.pathname.startsWith("/api/") && url.pathname !== "/api/product-image")
  )
    setHeader(event, "X-Robots-Tag", "noindex, follow");
  if (
    ["GET", "HEAD"].includes(event.method) &&
    (url.hostname === "nabo-new.vercel.app" ||
      (url.hostname === "www.nabo.by" && (await apexIsServing())))
  )
    return sendRedirect(
      event,
      PRIMARY_SITE_ORIGIN + url.pathname + url.search,
      301,
    );
  // Short category links consolidate onto the existing category route.
  if (
    ["GET", "HEAD"].includes(event.method) &&
    /^\/recipes\/[a-z-]+$/.test(url.pathname)
  ) {
    const slug = url.pathname.split("/").at(-1)!;
    if (
      defaultCategories.some((c) => c.id === slug) &&
      (await categoriesFor(event)).some((c) => c.id === slug)
    )
      return sendRedirect(event, `/recipes/category/${slug}${url.search}`, 301);
  }
  if (
    ["GET", "HEAD"].includes(event.method) &&
    url.pathname === "/stores/euroopt"
  )
    return sendRedirect(event, "/stores/evroopt" + url.search, 301);
  if (
    event.method === "GET" &&
    url.pathname === "/recipes" &&
    !url.searchParams.get("q") &&
    (await categoriesFor(event)).some(
      (c) => c.id === url.searchParams.get("category"),
    )
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
