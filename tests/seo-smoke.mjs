import { createServer, request } from "node:http";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const fixturePort = 3121,
  appPort = 3120,
  origin = "https://nabo.by";
const recipe = {
  id: "seo-test",
  slug: "seo-test",
  title: "Проверочный суп",
  description: "Пошаговый рецепт супа",
  image: "https://example.com/recipe.jpg",
  categoryId: "soups",
  tags: [],
  servings: 2,
  cookingTime: 20,
  source: "Тест",
  sourceId: "seo-test",
  isActive: true,
  shopabilityScore: 100,
  ingredients: [
    {
      ingredientId: "water",
      name: "Вода",
      quantity: 500,
      unit: "ml",
      searchQuery: "Вода",
    },
  ],
  instructions: [{ text: "Вскипятить воду" }],
};
const document = {
  recipe,
  ingredients: [
    {
      id: "water",
      name: "Вода",
      aliases: [],
      searchTerms: ["Вода"],
      pantry: false,
      common: true,
    },
  ],
};
const product = {
  id: "sku-1",
  storeId: "green",
  name: "Молоко тестовое",
  unit: "1 л",
  price: 4.25,
  oldPrice: null,
  image: "https://example.com/product.jpg",
  stock: 10,
  available: true,
  fetchedAt: new Date().toISOString(),
  externalUrl: "https://example.com/buy",
  placeSlug: "green",
};
let ingestion = 0;
const fixture = createServer(async (req, res) => {
  const url = new URL(req.url, "http://fixture");
  let input = "";
  for await (const part of req) input += part;
  let body = input ? JSON.parse(input) : {},
    data;
  if (url.pathname === "/api/seo/products" && req.method === "POST") {
    assert.equal(req.headers["x-nabo-seo-key"], "fixture-key");
    ingestion += body.items.length;
    data = { saved: body.items.length };
  } else if (url.pathname === "/api/seo/manifest")
    data = { recipes: 4001, products: 2001 };
  else if (url.pathname === "/api/seo/recipes")
    data = { items: [{ slug: "seo-test", image: recipe.image }] };
  else if (url.pathname === "/api/seo/products")
    data = {
      total: 1,
      items: [
        {
          storeId: product.storeId,
          id: product.id,
          name: product.name,
          unit: product.unit,
          image: product.image,
          updatedAt: "2026-10-01T00:00:00Z",
        },
      ],
    };
  else if (url.pathname === "/api/yandex/search/batch")
    data = {
      items: body.queries.map((query) => ({
        query,
        result: {
          storeId: "evroopt",
          placeSlug: "evroopt",
          status: "ok",
          products: [
            {
              ...product,
              id: "water",
              storeId: "evroopt",
              name: "Вода питьевая",
              unit: "1 л",
              price: 1.2,
            },
          ],
          fetchedAt: product.fetchedAt,
          currency: "BYN",
        },
      })),
    };
  else if (url.pathname === "/api/products/resolve")
    data = {
      items: body.items.map((item) => ({ ...item, status: "ok", product })),
    };
  else if (url.pathname === "/api/recipe-catalog/page") {
    const category = url.searchParams.get("category"),
      collection = url.searchParams.get("collection");
    const empty =
      !!(category && category !== "soups") ||
      ["budget", "protein"].includes(collection);
    data = {
      total: empty ? 0 : 36,
      documents: empty ? [] : [document],
    };
  } else if (url.pathname === "/api/recipe-catalog/seo-test")
    data = { document };
  else if (url.pathname === "/api/recipe-catalog")
    data = { documents: [document] };
  else if (url.pathname === "/api/product")
    data = [product.id, "sku/2&3"].includes(body.id)
      ? { status: "ok", product: { ...product, id: body.id } }
      : { status: "not_found" };
  else if (url.pathname === "/api/search")
    data = {
      stores: [{ storeId: "green", status: "ok", products: [product] }],
    };
  else if (url.pathname === "/be/api/v2/search") data = { food: [1] };
  else if (url.pathname === "/be/api/foods")
    data = {
      "hydra:member": [
        {
          id: 1,
          enabled: true,
          name: "Суп готовый",
          price: 9,
          isOpen: true,
          showWeight: true,
          weight: 250,
          weightUnitStr: "г",
          restaurant: {
            id: 1,
            type: 1,
            name: "Проверочное кафе",
            slug: "test-cafe",
            isOpened: true,
          },
        },
      ],
    };
  else {
    res.writeHead(404);
    res.end("{}");
    return;
  }
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(data));
});
await new Promise((resolve) =>
  fixture.listen(fixturePort, "127.0.0.1", resolve),
);
const child = spawn(process.execPath, [".output/server/index.mjs"], {
  env: {
    ...process.env,
    PORT: String(appPort),
    HOST: "127.0.0.1",
    NUXT_RECIPES_API_BASE: `http://127.0.0.1:${fixturePort}`,
    NUXT_RETAIL_API_BASE: `http://127.0.0.1:${fixturePort}`,
    NUXT_DINING_API_BASE: `http://127.0.0.1:${fixturePort}`,
    NUXT_SEO_INGEST_KEY: "fixture-key",
    NUXT_PUBLIC_SITE_URL: "https://nabo-new.vercel.app", // Intentionally stale deployment variable.
    NUXT_PUBLIC_SEO_INDEXABLE: "true",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
child.stdout.on("data", (b) => (logs += b));
child.stderr.on("data", (b) => (logs += b));
const base = `http://127.0.0.1:${appPort}`;
function hostPage(path, host = "nabo.by") {
  return new Promise((resolve, reject) => {
    const req = request(
      base + path,
      { headers: { host, "user-agent": "Googlebot" } },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          resolve(
            new Response(Buffer.concat(chunks), {
              status: res.statusCode,
              headers: res.headers,
            }),
          ),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
}
const get = hostPage;

try {
  for (let i = 0; i < 50; i++) {
    try {
      await get("/robots.txt");
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  const preview = await hostPage("/recipes/seo-test", "nabo-new.vercel.app");
  assert.equal(preview.status, 301);
  assert.equal(
    preview.headers.get("location"),
    "https://nabo.by/recipes/seo-test",
  );
  const branch = await hostPage(
    "/recipes/seo-test",
    "branch-preview.vercel.app",
  );
  assert.match(branch.headers.get("x-robots-tag"), /noindex/);
  assert.match(await branch.text(), /name="robots" content="noindex,follow"/);
  const previewRobots = await hostPage(
    "/robots.txt",
    "branch-preview.vercel.app",
  );
  const previewRules = await previewRobots.text();
  assert.match(previewRules, /Allow: \//);
  assert.doesNotMatch(previewRules, /Sitemap:/);
  assert.doesNotMatch(previewRules, /^Disallow: \/$/m);
  assert.equal(
    (await hostPage("/sitemap.xml", "branch-preview.vercel.app")).status,
    404,
  );
  const apex = await hostPage("/recipes/seo-test?utm_source=test", "nabo.by");
  assert.equal(apex.status, 200);
  for (const path of [
    "/",
    "/does-not-exist",
    "/api/product-image?url=" + encodeURIComponent("https://127.0.0.1/private"),
  ]) {
    const response = await get(path);
    assert.equal(response.headers.get("x-powered-by"), null);
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.match(
      response.headers.get("permissions-policy"),
      /geolocation=\(self\)/,
    );
    assert.match(
      response.headers.get("content-security-policy"),
      /frame-ancestors 'none'/,
    );
    if (path.startsWith("/api/product-image"))
      assert.equal(response.status, 400);
  }
  const robots = await (await get("/robots.txt")).text();
  assert.match(robots, /Allow: \/api\/product-image/);
  assert.match(robots, /Sitemap: https:\/\/nabo\.by\/sitemap.xml/);
  const index = await (await get("/sitemap.xml")).text();
  assert.match(index, /recipes-3.xml/);
  assert.match(index, /products-2.xml/);
  const xml = await (await get("/sitemaps/recipes-1.xml")).text();
  assert.match(xml, /<loc>https:\/\/nabo\.by\/recipes\/seo-test<\/loc>/);
  assert.equal((await get("/sitemaps/recipes-4.xml")).status, 404);
  const redirect = await get("/recipes?category=soups");
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.get("location"), "/recipes/category/soups");
  const category = await (await get("/recipes/category/soups?page=2")).text();
  assert.match(
    category,
    /canonical[^>]+https:\/\/nabo\.by\/recipes\/category\/soups\?page=2/,
  );
  assert.match(category, /page=1|\/recipes\/category\/soups/);
  assert.match(category, /ItemList/);
  const recipeResponse = await get("/recipes/seo-test?utm_source=blog");
  assert.equal(recipeResponse.status, 200);
  const recipeHtml = await recipeResponse.text();
  assert.match(recipeHtml, /Проверочный суп/);
  assert.match(recipeHtml, /Вскипятить воду/);
  assert.match(recipeHtml, /"@type":"Recipe"/);
  assert.match(
    recipeHtml,
    /canonical[^>]+https:\/\/nabo\.by\/recipes\/seo-test"/,
  );
  assert.match(recipeHtml, /Суп готовый/);
  assert.match(recipeHtml, /Проверочное кафе/);
  assert.match(recipeHtml, /dining-offers-schema/);
  const homeHtml = await (await get("/")).text();
  assert.match(homeHtml, /Что сегодня/);
  assert.match(homeHtml, /href="\/recipes\/seo-test"/);
  const comparison = await get("/cook-or-order/seo-test");
  assert.equal(comparison.status, 200);
  const comparisonHtml = await comparison.text();
  assert.match(
    comparisonHtml,
    /Проверочный суп: приготовить дома или заказать/,
  );
  assert.match(comparisonHtml, /Проверочное кафе/);
  assert.match(comparisonHtml, /1,20/);
  assert.match(comparisonHtml, /0,60/);
  const topicHtml = await (await get("/products/moloko")).text();
  assert.match(topicHtml, /Молоко тестовое/);
  assert.match(topicHtml, /href="\/product\/green\/sku-1"/);
  const staticMap = await (await get("/sitemaps/static.xml")).text();
  assert.match(staticMap, /\/products\/moloko/);
  assert.doesNotMatch(staticMap, /\/products\/tvorog/);
  assert.doesNotMatch(staticMap, /\/recipes\/budget/);
  const emptyTopic = await get("/recipes/budget");
  assert.match(emptyTopic.headers.get("x-robots-tag"), /noindex/);
  assert.match(await emptyTopic.text(), /noindex,follow/);
  const compareMap = await (await get("/sitemaps/cook-or-order-1.xml")).text();
  assert.match(compareMap, /\/cook-or-order\/seo-test/);
  assert.equal((await get("/recipes/soups")).status, 301);
  assert.equal((await get("/products/not-a-product")).status, 404);
  assert.equal((await get("/cook-or-order/missing")).status, 404);
  for (const source of [homeHtml, recipeHtml, comparisonHtml, topicHtml]) {
    for (const match of source.matchAll(
      /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
    ))
      JSON.parse(match[1]);
    assert.doesNotMatch(source, /https:\/\/www\.nabo\.by|http:\/\/localhost/);
  }
  const productResponse = await get("/product/green/sku-1");
  assert.equal(productResponse.status, 200);
  const html = await productResponse.text();
  assert.match(html, /Молоко тестовое/);
  assert.match(html, /"@type":"Product"/);
  assert.match(html, /"price":4.25/);
  assert.match(
    html,
    /canonical[^>]+https:\/\/nabo\.by\/product\/green\/sku-1"/,
  );
  assert.equal(
    (await get("/product/green/sku%2F2%263")).status,
    200,
    "encoded SKU is decoded exactly once",
  );
  assert.equal((await get("/product/green/missing")).status, 404);
  assert.equal((await get("/recipes/missing")).status, 404);
  const privateResponse = await get("/basket");
  assert.match(privateResponse.headers.get("x-robots-tag"), /noindex/);
  assert.match(
    privateResponse.headers.get("cache-control"),
    /private, no-store/,
  );
  assert.match(
    await privateResponse.text(),
    /name="robots" content="noindex,follow"/,
  );
  const search = await get("/products?q=молоко");
  assert.match(search.headers.get("x-robots-tag"), /noindex/);
  const hub = await (await get("/products")).text();
  assert.match(hub, /href="\/product\/green\/sku-1"/);
  await fetch(base + "/api/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: "молоко",
      location: { lat: 53.9, lon: 27.5667 },
    }),
  });
  await new Promise((r) => setTimeout(r, 200));
  assert.ok(ingestion > 0);
  if (process.argv.includes("--browser")) {
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch({
      channel: "chrome",
      headless: true,
    });
    try {
      for (const width of [390, 1440]) {
        const page = await browser.newPage({
          viewport: { width, height: 900 },
        });
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        for (const path of [
          "/cook-or-order/seo-test",
          "/products/moloko",
          "/recipes/quick",
        ]) {
          await page.goto(base + path, { waitUntil: "networkidle" });
          assert.equal(await page.locator("h1").count(), 1);
          assert.ok(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
            path + " must fit viewport",
          );
          assert.equal(
            await page.locator('nav[aria-label="Хлебные крошки"]').count(),
            1,
          );
          await page.screenshot({
            path: `/tmp/nabo-seo-${width}-${path.split("/")[1]}.png`,
            fullPage: true,
          });
        }
        assert.deepEqual(errors, []);
        await page.close();
      }
    } finally {
      await browser.close();
    }
  }
  console.log(
    "PASS: raw server HTML, recipe/product/dining schemas, metadata, 404, robots, category redirect, pagination, split sitemaps and background discovery",
  );
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  child.kill("SIGTERM");
  await new Promise((r) => fixture.close(r));
  fixture.closeAllConnections();
}
