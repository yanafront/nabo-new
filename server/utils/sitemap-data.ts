import type { H3Event } from "h3";
import { seoService } from "./seo-service";
import { publishedRecipes } from "./published-recipes";
import { SEO_PAGE_SIZE } from "../../shared/seo/core";
export async function sitemapManifest(event: H3Event): Promise<{recipes:number;products:number}> {
  try {
    return (await seoService(event, "/api/seo/manifest")) as {
      recipes: number;
      products: number;
    };
  } catch (error: any) {
    if (![404, 405].includes(error.statusCode || error.response?.status))
      throw error;
    const c = await publishedRecipes(event);
    return { recipes: c.recipes.filter((r) => r.isActive).length, products: 0 };
  }
}
export async function sitemapRecipes(event: H3Event, page: number) {
  try {
    return (
      await seoService(event, "/api/seo/recipes", {
        offset: (page - 1) * SEO_PAGE_SIZE,
        limit: SEO_PAGE_SIZE,
      })
    ).items as Array<{ slug: string; image?: string }>;
  } catch (error: any) {
    if (![404, 405].includes(error.statusCode || error.response?.status))
      throw error;
    const c = await publishedRecipes(event);
    return c.recipes
      .filter((r) => r.isActive)
      .slice((page - 1) * SEO_PAGE_SIZE, page * SEO_PAGE_SIZE);
  }
}
