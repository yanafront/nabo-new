import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import {
  createApp,
  createRouter,
  defineEventHandler,
  toNodeListener,
  readBody,
  createError,
  getRequestURL,
  getRouterParam,
  setHeader,
} from "h3";
let upstream: Server, frontend: Server, base: string;
let key = "test-secret",
  retailCalls = 0,
  probeCalls = 0,
  lastBody: any;
const stored = new Map<string, any>();
const item = {
  storeId: "green",
  id: "milk",
  name: "Молоко",
  unit: "1 л",
  available: true,
  price: 5,
};
async function listen(s: Server) {
  s.listen(0, "127.0.0.1");
  await once(s, "listening");
  return `http://127.0.0.1:${(s.address() as { port: number }).port}`;
}
beforeAll(async () => {
  upstream = createServer(async (req, res) => {
    let text = "";
    for await (const part of req) text += part;
    const body = text ? JSON.parse(text) : {};
    res.setHeader("content-type", "application/json");
    if (req.url === "/api/admin/recipes/access") {
      const status =
        req.headers.authorization === "Bearer admin-token"
          ? 200
          : req.headers.authorization
            ? 403
            : 401;
      res.statusCode = status;
      return res.end(JSON.stringify({ authorized: status === 200 }));
    }
    if (req.url === "/api/seo/manifest")
      return res.end(JSON.stringify({ products: stored.size, recipes: 1 }));
    if (req.url === "/api/recipe-categories")
      return res.end(JSON.stringify({ categories: [] }));
    if (req.url === "/api/seo/products" && req.method === "GET")
      return res.end(
        JSON.stringify({ total: stored.size, items: [...stored.values()] }),
      );
    if (req.url === "/api/seo/products") {
      probeCalls++;
      if (req.headers["x-nabo-seo-key"] !== "test-secret") {
        res.statusCode = 401;
        return res.end("{}");
      }
      for (const row of body.items) stored.set(row.storeId + ":" + row.id, row);
      return res.end(JSON.stringify({ saved: body.items.length }));
    }
    if (req.url === "/api/yandex/search/batch") {
      retailCalls++;
      lastBody = body;
      return res.end(
        JSON.stringify({
          items: body.queries.map((query: string) => ({
            query,
            result: {
              status: query === "Нет ответа" ? "error" : "ok",
              products:
                query === "Нет ответа"
                  ? []
                  : [
                      item,
                      item,
                      { ...item, storeId: "santa", id: "other" },
                      { ...item, id: "bad", name: "x".repeat(501) },
                    ],
            },
          })),
        }),
      );
    }
    res.statusCode = 404;
    res.end("{}");
  });
  const upstreamBase = await listen(upstream);
  vi.stubGlobal("useRuntimeConfig", () => ({
    recipesApiBase: upstreamBase,
    retailApiBase: upstreamBase,
    seoIngestKey: key,
    public: { seoIndexable: true, siteUrl: "https://www.nabo.by" },
  }));
  vi.stubGlobal("defineCachedFunction", (fn: any) => fn);
  for (const [name, value] of Object.entries({
    defineEventHandler,
    readBody,
    createError,
    getRequestURL,
    getRouterParam,
    setHeader,
  }))
    vi.stubGlobal(name, value);
  vi.stubGlobal("$fetch", async (url: string, options: any = {}) => {
    const r = await fetch(url, {
      method: options.method || "GET",
      headers: { ...options.headers, "content-type": "application/json" },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!r.ok) throw { statusCode: r.status };
    return r.json();
  });
  const router = createRouter();
  router.post(
    "/api/admin/seo-products/check",
    (await import("../server/api/admin/seo-products/check.post")).default,
  );
  router.post(
    "/api/admin/seo-products/import",
    (await import("../server/api/admin/seo-products/import.post")).default,
  );
  router.get(
    "/sitemap.xml",
    (await import("../server/routes/sitemap.xml.get")).default,
  );
  router.get(
    "/sitemaps/:file",
    (await import("../server/routes/sitemaps/[file].get")).default,
  );
  const app = createApp();
  app.use(router);
  frontend = createServer(toNodeListener(app));
  base = await listen(frontend);
});
afterAll(async () => {
  await Promise.all(
    [upstream, frontend].map(
      (s) =>
        new Promise<void>((r) => {
          s.close(() => r());
          s.closeAllConnections();
        }),
    ),
  );
  vi.unstubAllGlobals();
});
const post = (
  path: string,
  body: any = {},
  token = "admin-token",
  origin?: string,
) =>
  fetch(base + "/api/admin/seo-products/" + path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { cookie: `nabo-session=${token}` } : {}),
      ...(origin ? { origin } : {}),
    },
    body: JSON.stringify(body),
  });
it("blocks guests, non-editors and cross-origin requests before touching the feed", async () => {
  const before = probeCalls;
  expect((await post("check", {}, "")).status).toBe(401);
  expect((await post("check", {}, "ordinary")).status).toBe(403);
  expect(
    (await post("import", {}, "admin-token", "https://evil.example")).status,
  ).toBe(403);
  expect(probeCalls).toBe(before);
});
it("diagnoses missing and mismatched keys without leaking secrets or creating products", async () => {
  key = "";
  expect(await (await post("check")).json()).toMatchObject({
    keyConfigured: false,
    connection: "missing_key",
    products: 0,
  });
  key = "wrong-private-key";
  const denied = await (await post("check")).text();
  expect(denied).toContain("rejected_key");
  expect(denied).not.toContain(key);
  key = "test-secret";
  expect(await (await post("check")).json()).toMatchObject({
    connection: "ready",
    products: 0,
  });
  expect(stored.size).toBe(0);
  expect(await (await fetch(base + "/sitemap.xml")).text()).not.toContain(
    "products-1.xml",
  );
});
it("imports only real selected-store results, deduplicates and exposes partial search failures", async () => {
  const body = {
    storeId: "green",
    queries: ["Молоко", "Молоко", "Нет ответа"],
    location: { lat: 53.9, lon: 27.5667, label: "Private address" },
  };
  const r = await post("import", body);
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual({
    saved: 1,
    queries: 2,
    failedQueries: ["Нет ответа"],
  });
  expect(lastBody.limit).toBe(20);
  expect(lastBody.location.label).toBe("Точка поиска");
  expect([...stored.values()]).toEqual([
    { storeId: "green", id: "milk", name: "Молоко", unit: "1 л" },
  ]);
  await post("import", body);
  expect(stored.size).toBe(1);
  expect(await (await post("check")).json()).toMatchObject({
    products: 1,
    connection: "ready",
  });
  expect(await (await fetch(base + "/sitemap.xml")).text()).toContain(
    "https://www.nabo.by/sitemaps/products-1.xml",
  );
  expect(
    await (await fetch(base + "/sitemaps/products-1.xml")).text(),
  ).toContain("<loc>https://www.nabo.by/product/green/milk</loc>");
});
it("rejects arbitrary product payloads and unbounded queries before calling retail", async () => {
  const before = retailCalls;
  for (const body of [
    { items: [item] },
    {
      storeId: "green",
      queries: Array(6).fill("Молоко"),
      location: { lat: 53.9, lon: 27 },
    },
    {
      storeId: "unknown",
      queries: ["Молоко"],
      location: { lat: 53.9, lon: 27 },
    },
  ])
    expect((await post("import", body)).status).toBe(400);
  expect(retailCalls).toBe(before);
});
