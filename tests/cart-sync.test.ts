import { expect, it, vi } from "vitest";
import type { Item } from "../data/catalog";
import { createCartSync } from "../shared/cart-sync";
import { accountCartItems } from "../shared/account-cart";
import { appendCartItems } from "../shared/cart-actions";
const row = (id: string, quantity = 1): Item => ({
  productId: `green:${id}`,
  quantity,
  product: {
    id: `green:${id}`,
    sourceId: id,
    storeId: "green",
    name: id,
    unit: "1 л",
    price: 3,
    brand: "",
    emoji: "",
    keywords: [],
  },
});
function setup(initial: Item[] = [], remote: Item[] = []) {
  let items = initial;
  let stored = accountCartItems(remote);
  const status = vi.fn();
  const request = vi.fn(async (url: string, options?: any): Promise<any> => {
    if (url === "/api/auth/me") return { id: "user" };
    if (options?.method === "POST") {
      stored = options.body.items;
      return true;
    }
    return { items: structuredClone(stored) };
  });
  const sync = createCartSync({
    read: () => items,
    write: (value) => {
      items = value;
    },
    request,
    status,
    location: () => ({ lat: 53.9, lon: 27.5667, label: "Минск" }),
  });
  return {
    sync,
    request,
    status,
    items: () => items,
    remoteSet: (rows: Item[]) => {
      stored = accountCartItems(rows);
    },
  };
}
it("loads only the backend cart and does not upload stale browser items", async () => {
  const c = setup([row("browser")], [row("remote", 2)]);
  await c.sync.initialize();
  expect(c.items().map((row) => row.productId)).toEqual(["green:remote"]);
  expect(
    c.request.mock.calls.filter((call) => call[1]?.method === "POST"),
  ).toEqual([]);
});
it("fetches fresh backend items before adding one and preserves products added on another device", async () => {
  const c = setup([], [row("old")]);
  await c.sync.initialize();
  c.remoteSet([row("old"), row("other-device", 2)]);
  expect(
    await c.sync.mutate((current) => appendCartItems(current, [row("new")])),
  ).toBe(true);
  const post = c.request.mock.calls.find((call) => call[1]?.method === "POST")!;
  expect(post[1].body.items.map((item: any) => [item.id, item.count])).toEqual([
    ["old", 1],
    ["other-device", 2],
    ["new", 1],
  ]);
  const postIndex = c.request.mock.calls.indexOf(post);
  expect(c.request.mock.calls[postIndex - 1][1]).not.toHaveProperty("query");
  expect(c.request.mock.calls[postIndex + 1][1].query).toEqual({
    lat: 53.9,
    lon: 27.5667,
  });
});
it("always clears through POST items:[], even when the local screen is already empty", async () => {
  const c = setup([], [row("remote")]);
  expect(await c.sync.clear()).toBe(true);
  const post = c.request.mock.calls.find((call) => call[1]?.method === "POST")!;
  expect(post[1].body).toEqual({ items: [] });
  expect(c.items()).toEqual([]);
});
it("does not clear the screen if the server rejects clearing", async () => {
  const c = setup([], [row("remote")]);
  await c.sync.initialize();
  c.request.mockRejectedValueOnce({ statusCode: 502 });
  expect(await c.sync.clear()).toBe(false);
  expect(c.items()[0].productId).toBe("green:remote");
  expect(c.sync.comparisonItems()).toBeNull();
});
it("serializes rapid additions; every operation reads the result of the previous save", async () => {
  const c = setup([], [row("old")]);
  const first = c.sync.mutate((current) =>
    appendCartItems(current, [row("new")]),
  );
  const second = c.sync.mutate((current) =>
    appendCartItems(current, [row("new")]),
  );
  await Promise.all([first, second]);
  const posts = c.request.mock.calls.filter(
    (call) => call[1]?.method === "POST",
  );
  expect(
    posts.map(
      (call) => call[1].body.items.find((item: any) => item.id === "new").count,
    ),
  ).toEqual([1, 2]);
  expect(c.items()).toHaveLength(2);
});
it("requires login and never falls back to saving a local cart", async () => {
  const c = setup([row("local")]);
  c.request.mockRejectedValue({ statusCode: 401 });
  expect(
    await c.sync.mutate((current) => appendCartItems(current, [row("new")])),
  ).toBe(false);
  expect(c.request.mock.calls.every((call) => call[0] === "/api/auth/me")).toBe(
    true,
  );
  expect(c.items()).toEqual([]);
  expect(c.status).toHaveBeenLastCalledWith("guest", expect.any(String));
});
it("does not save when loading the current backend cart fails", async () => {
  const c = setup([], [row("old")]);
  await c.sync.initialize();
  c.request.mockRejectedValueOnce({ statusCode: 502 });
  expect(
    await c.sync.mutate((current) => appendCartItems(current, [row("new")])),
  ).toBe(false);
  expect(
    c.request.mock.calls.filter((call) => call[1]?.method === "POST"),
  ).toEqual([]);
  expect(c.items()[0].productId).toBe("green:old");
});
it("refreshing after a failed save reloads the backend, without replaying an addition", async () => {
  const c = setup([], [row("old")]);
  await c.sync.initialize();
  c.request.mockImplementationOnce(async () => ({
    items: accountCartItems([row("old")]),
  }));
  c.request.mockRejectedValueOnce({ statusCode: 502 });
  expect(
    await c.sync.mutate((current) => appendCartItems(current, [row("new")])),
  ).toBe(false);
  await c.sync.refresh();
  expect(c.items().map((row) => row.productId)).toEqual(["green:old"]);
  expect(
    c.request.mock.calls.filter((call) => call[1]?.method === "POST"),
  ).toHaveLength(1);
});
it("comparison uses only the latest saved server name and count", async () => {
  const c = setup();
  await c.sync.initialize();
  c.remoteSet([row("Saved product", 5)]);
  await c.sync.refresh();
  expect(c.sync.comparisonItems()).toEqual([
    {
      id: "green:Saved product",
      query: "Saved product",
      exactName: "Saved product",
      quantity: 5,
      unit: "1 л",
    },
  ]);
});
