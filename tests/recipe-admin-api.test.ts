import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import {
  createApp,
  createRouter,
  defineEventHandler,
  toNodeListener,
  getRouterParam,
  getQuery,
  createError,
  sendWebResponse,
  getHeader,
  readMultipartFormData,
  readBody,
} from "h3";
import { recipePhotoType } from "../shared/recipe/photo";
let upstream: Server, frontend: Server, base: string;
let last: { url?: string; method?: string; body: string; token?: string };
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
      method: req.method,
      body,
      token: req.headers.authorization,
    };
    res.setHeader("content-type", "application/json");
    if (req.headers.authorization === "Bearer undeployed-token") {
      res.statusCode = 404;
      return res.end("{}");
    }
    if (req.headers.authorization !== "Bearer admin-token") {
      res.statusCode = req.headers.authorization ? 403 : 401;
      return res.end("{}");
    }
    if (req.method === "DELETE") {
      res.statusCode = req.url?.endsWith("revision=3") ? 204 : 409;
      return res.end();
    }
    if (req.method === "PUT") {
      res.statusCode = 409;
      return res.end('{"message":"revision conflict"}');
    }
    if (req.url?.endsWith("access")) return res.end('{"authorized":true}');
    return res.end('{"records":[]}');
  });
  const retailApiBase = await listen(upstream);
  vi.stubGlobal("useRuntimeConfig", () => ({
    recipesApiBase: retailApiBase,
    retailApiBase: "http://127.0.0.1:1",
    recipePhotos: {
      accountId: "",
      accessKeyId: "privateKey",
      secretAccessKey: "privateSecret",
      bucket: "",
      publicBase: "",
    },
  }));
  for (const [name, value] of Object.entries({
    defineEventHandler,
    getRouterParam,
    getQuery,
    createError,
    sendWebResponse,
    getHeader,
    readMultipartFormData,
    readBody,
  }))
    vi.stubGlobal(name, value);
  const router = createRouter();
  router.get(
    "/api/admin/recipes",
    (await import("../server/api/admin/recipes.get")).default,
  );
  router.put(
    "/api/admin/recipes/:slug",
    (await import("../server/api/admin/recipes/[slug].put")).default,
  );
  router.patch(
    "/api/admin/recipes/:slug/classification",
    (await import("../server/api/admin/recipes/[slug]/classification.patch"))
      .default,
  );
  router.delete(
    "/api/admin/recipes/:slug",
    (await import("../server/api/admin/recipes/[slug].delete")).default,
  );
  router.post(
    "/api/admin/recipe-photo",
    (await import("../server/api/admin/recipe-photo.post")).default,
  );
  const app = createApp();
  app.use(router);
  frontend = createServer(toNodeListener(app));
  base = await listen(frontend);
});
afterAll(async () => {
  frontend.close();
  upstream.close();
  vi.unstubAllGlobals();
});
it("does not reveal the catalog to guests or non-admin users", async () => {
  expect((await fetch(base + "/api/admin/recipes")).status).toBe(401);
  expect(
    (
      await fetch(base + "/api/admin/recipes", {
        headers: { cookie: "nabo-session=ordinary-token" },
      })
    ).status,
  ).toBe(403);
});
it("returns editor catalog only after backend authorization and never exposes storage keys", async () => {
  const response = await fetch(base + "/api/admin/recipes", {
    headers: { cookie: "nabo-session=admin-token" },
  });
  const text = await response.text();
  const data = JSON.parse(text);
  expect(data.records).toEqual([]);
  expect(data).not.toHaveProperty("catalog");
  expect(data.photosConfigured).toBe(false);
  expect(text).not.toContain("privateSecret");
  expect(text).not.toContain("privateKey");
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("forwards revision conflicts and request bodies without changing publication semantics", async () => {
  const payload = {
    document: { recipe: { title: "Test" } },
    revision: 3,
    publish: false,
  };
  const response = await fetch(base + "/api/admin/recipes/test-recipe", {
    method: "PUT",
    headers: {
      cookie: "nabo-session=admin-token",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  expect(response.status).toBe(409);
  expect(last.url).toBe("/api/admin/recipes/test-recipe");
  expect(last.method).toBe("PUT");
  expect(JSON.parse(last.body)).toEqual(payload);
  expect(last.token).toBe("Bearer admin-token");
});
it("rejects foreign-origin writes", async () => {
  expect(
    (
      await fetch(base + "/api/admin/recipes/test", {
        method: "PUT",
        headers: { origin: "https://evil.test" },
        body: "{}",
      })
    ).status,
  ).toBe(403);
});
it("checks admin access before processing photo uploads", async () => {
  expect(
    (await fetch(base + "/api/admin/recipe-photo", { method: "POST" })).status,
  ).toBe(401);
  expect(
    (
      await fetch(base + "/api/admin/recipe-photo", {
        method: "POST",
        headers: { cookie: "nabo-session=ordinary-token" },
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await fetch(base + "/api/admin/recipe-photo", {
        method: "POST",
        headers: { cookie: "nabo-session=admin-token" },
      })
    ).status,
  ).toBe(503);
});
it("recognizes photo bytes and rejects SVG or a disguised extension", () => {
  expect(
    recipePhotoType(
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]),
    ),
  ).toBe("png");
  expect(
    recipePhotoType(new Uint8Array([255, 216, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
  ).toBe("jpg");
  expect(recipePhotoType(new TextEncoder().encode("RIFFxxxxWEBPxxxx"))).toBe(
    "webp",
  );
  expect(
    recipePhotoType(new TextEncoder().encode("<svg>javascript</svg>")),
  ).toBeNull();
});

it("reports an undeployed editor API as unavailable instead of a missing page", async () => {
  const response = await fetch(base + "/api/admin/recipes", {
    headers: { cookie: "nabo-session=undeployed-token" },
  });
  expect(response.status).toBe(503);
  expect(await response.text()).toContain("API редактора ещё не подключён");
});

it("deletes only an authorized version and forwards conflicts", async () => {
  const url = base + "/api/admin/recipes/test?revision=3";
  expect((await fetch(url, { method: "DELETE" })).status).toBe(401);
  expect(
    (
      await fetch(url, {
        method: "DELETE",
        headers: { cookie: "nabo-session=ordinary-token" },
      })
    ).status,
  ).toBe(403);
  const response = await fetch(url, {
    method: "DELETE",
    headers: { cookie: "nabo-session=admin-token" },
  });
  expect(response.status).toBe(204);
  expect(last.url).toBe("/api/admin/recipes/test?revision=3");
  expect(last.token).toBe("Bearer admin-token");
  expect(
    (
      await fetch(base + "/api/admin/recipes/test?revision=2", {
        method: "DELETE",
        headers: { cookie: "nabo-session=admin-token" },
      })
    ).status,
  ).toBe(409);
  expect(
    (await fetch(base + "/api/admin/recipes/test", { method: "DELETE" }))
      .status,
  ).toBe(400);
  expect(
    (
      await fetch(url, {
        method: "DELETE",
        headers: { origin: "https://evil.test" },
      })
    ).status,
  ).toBe(403);
});

it("forwards only explicit classification changes, without a recipe document", async () => {
  const payload = {
    revision: 4,
    collections: { add: ["family"], remove: ["easy"] },
  };
  const response = await fetch(
    base + "/api/admin/recipes/test/classification",
    {
      method: "PATCH",
      headers: {
        cookie: "nabo-session=admin-token",
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  expect(response.status).toBe(200);
  expect(last.method).toBe("PATCH");
  expect(last.url).toBe("/api/admin/recipes/test/classification");
  expect(JSON.parse(last.body)).toEqual(payload);
});
it("classification rejects invalid, overlapping or empty flag changes", async () => {
  for (const collections of [
    { add: ["unknown"], remove: [] },
    { add: ["family"], remove: ["family"] },
    { add: [], remove: [] },
  ]) {
    const response = await fetch(
      base + "/api/admin/recipes/test/classification",
      {
        method: "PATCH",
        headers: {
          cookie: "nabo-session=admin-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ revision: 3, collections }),
      },
    );
    expect(response.status).toBe(400);
  }
});
it("classification requires authentication and same-origin writes", async () => {
  const body = JSON.stringify({ revision: 3, categoryId: "salads" });
  expect(
    (
      await fetch(base + "/api/admin/recipes/test/classification", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body,
      })
    ).status,
  ).toBe(401);
  expect(
    (
      await fetch(base + "/api/admin/recipes/test/classification", {
        method: "PATCH",
        headers: {
          origin: "https://evil.test",
          cookie: "nabo-session=admin-token",
          "content-type": "application/json",
        },
        body,
      })
    ).status,
  ).toBe(403);
});
