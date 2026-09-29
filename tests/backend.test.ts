/// <reference types="node" />
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import {
  createApp,
  createRouter,
  defineEventHandler,
  toNodeListener,
} from "h3";
let upstream: Server;
let frontend: Server;
let base: string;
let last: {
  url?: string;
  body: string;
  authorization?: string;
  cookie?: string;
};
async function listen(server: Server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}
beforeAll(async () => {
  upstream = createServer(async (req, res) => {
    let body = "";
    for await (const part of req) body += part;
    last = {
      url: req.url,
      body,
      authorization: req.headers.authorization,
      cookie: req.headers.cookie,
    };
    res.setHeader("content-type", "application/json");
    if (req.url === "/api/auth/login")
      return res.end(
        JSON.stringify({
          accessToken: "opaque-test-token",
          expiresIn: 3600,
          refreshToken: "private-refresh",
        }),
      );
    if (req.url === "/api/auth/me") {
      if (req.headers.authorization !== "Bearer opaque-test-token") {
        res.statusCode = 401;
        return res.end("{}");
      }
      return res.end(
        JSON.stringify({ id: "user-1", phoneNumber: "+375291234567" }),
      );
    }
    if (req.url === "/api/auth/register") {
      res.statusCode = 409;
      return res.end('{"message":"already registered"}');
    }
    if (body.includes('"limited"')) {
      res.statusCode = 429;
      res.setHeader("retry-after", "60");
      return res.end('{"message":"rate limited"}');
    }
    if (req.url?.startsWith("/api/product-image")) {
      res.setHeader("content-type", "image/png");
      return res.end(Buffer.from([137, 80, 78, 71]));
    }
    if (
      req.url === "/api/yandex/compare" &&
      JSON.parse(body || "{}").items?.[0]?.id === "recipe-test"
    ) {
      const product = {
        id: "chicken",
        storeId: "green",
        name: "Куриное филе",
        unit: "450 г",
        price: 5,
        available: true,
        stock: 10,
      };
      return res.end(
        JSON.stringify({
          offers: [
            {
              storeId: "green",
              lines: [
                {
                  itemId: "recipe-test",
                  query: "Куриное филе",
                  quantity: 1,
                  selected: product,
                  alternatives: [],
                },
              ],
            },
          ],
        }),
      );
    }
    res.end(JSON.stringify({ received: JSON.parse(body || "{}") }));
  });
  const backend = await listen(upstream);
  vi.stubGlobal("useRuntimeConfig", () => ({ retailApiBase: backend }));
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  const router = createRouter();
  router.post(
    "/api/yandex/search",
    (await import("../server/api/yandex/search.post")).default,
  );
  router.post(
    "/api/yandex/compare",
    (await import("../server/api/yandex/compare.post")).default,
  );
  router.get(
    "/api/product-image",
    (await import("../server/api/product-image.get")).default,
  );
  router.post(
    "/api/auth/login",
    (await import("../server/api/auth/login.post")).default,
  );
  router.post(
    "/api/auth/register",
    (await import("../server/api/auth/register.post")).default,
  );
  router.get(
    "/api/auth/me",
    (await import("../server/api/auth/me.get")).default,
  );
  router.post(
    "/api/auth/logout",
    (await import("../server/api/auth/logout.post")).default,
  );
  frontend = createServer(toNodeListener(createApp().use(router)));
  base = await listen(frontend);
});
afterAll(async () => {
  await Promise.all(
    [frontend, upstream].map(
      (s) =>
        new Promise<void>((resolve) => {
          s.close(() => resolve());
          s.closeAllConnections();
        }),
    ),
  );
  vi.unstubAllGlobals();
});
const post = (path: string, body: unknown, headers = {}) =>
  fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
describe("ASP.NET backend bridge", () => {
  it("forwards search and comparison contracts without browser cookies", async () => {
    for (const path of ["/api/yandex/search", "/api/yandex/compare"]) {
      const body = {
        query: "молоко",
        location: { lat: 53.9, lon: 27.56 },
        items: [{ id: "milk", quantity: 2 }],
      };
      const res = await post(path, body, { cookie: "unrelated=secret" });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ received: body });
      expect(last.url).toBe(path);
      expect(last.cookie).toBeUndefined();
    }
  });
  it("sizes recipe quantities while keeping the backend contract unchanged", async () => {
    const requirement = {
      ingredientId: "chicken-breast",
      query: "Куриное филе",
      amount: 600,
      dimension: "mass",
    };
    const res = await post("/api/yandex/compare", {
      items: [{ id: "recipe-test", query: "Филе", quantity: 1, requirement }],
    });
    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.offers[0].lines[0].quantity).toBe(2);
    expect(result.offers[0].lines[0].demand).toEqual(requirement);
    expect(JSON.parse(last.body).items[0]).toEqual({
      id: "recipe-test",
      query: "Куриное филе",
      quantity: 1,
    });
    const invalid = await post("/api/yandex/compare", {
      items: [
        { id: "recipe-test", requirement: { ...requirement, amount: -1 } },
      ],
    });
    expect(invalid.status).toBe(400);
  });
  it("preserves rate limit status and retry header", async () => {
    const res = await post("/api/yandex/search", { query: "limited" });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
  });
  it("keeps image query encoded and binary bytes intact", async () => {
    const url =
      "https://cdn.ime.by/UserFiles/images/catalog/Goods/a.png?x=1&y=2";
    const res = await fetch(
      base + "/api/product-image?url=" + encodeURIComponent(url),
    );
    expect(new URL("http://test" + last.url).searchParams.get("url")).toBe(url);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([
      137, 80, 78, 71,
    ]);
  });
  it("keeps tokens out of JSON and restores a session using Bearer", async () => {
    const res = await post("/api/auth/login", {
      phoneNumber: "+375291234567",
      password: "test-password",
    });
    expect(await res.json()).toEqual({ authenticated: true });
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    const me = await fetch(base + "/api/auth/me", {
      headers: { cookie: cookie.split(";")[0] },
    });
    expect(me.status).toBe(200);
    expect((await me.json()).phoneNumber).toBe("+375291234567");
    expect(last.authorization).toBe("Bearer opaque-test-token");
    expect(last.cookie).toBeUndefined();
  });
  it("preserves registration conflicts and clears expired sessions", async () => {
    expect((await post("/api/auth/register", {})).status).toBe(409);
    const res = await fetch(base + "/api/auth/me", {
      headers: { cookie: "nabo-session=expired" },
    });
    expect(res.status).toBe(401);
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
  });
  it("rejects cross-origin auth mutations and supports logout", async () => {
    expect(
      (await post("/api/auth/login", {}, { origin: "https://other.example" }))
        .status,
    ).toBe(403);
    const res = await post("/api/auth/logout", {}, { origin: base });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
