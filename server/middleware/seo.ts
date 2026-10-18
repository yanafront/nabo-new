import {
  seoPolicy,
  indexableHost,
  PRIMARY_SITE_ORIGIN,
} from "../../shared/seo/core";
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
  if (["GET", "HEAD"].includes(event.method) && url.hostname === "nabo.by")
    return sendRedirect(
      event,
      PRIMARY_SITE_ORIGIN + url.pathname + url.search,
      308,
    );
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
