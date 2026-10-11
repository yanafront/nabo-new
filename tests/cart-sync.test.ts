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
it("guest additions never call backend cart and quantities and clearing stay local", async () => {
  const c = setup();
  c.request.mockRejectedValue({ statusCode: 401 });
  expect(await c.sync.initialize()).toBe(true);
  expect(
    await c.sync.mutate((current) => appendCartItems(current, [row("new")])),
  ).toBe(true);
  expect(await c.sync.quantity("green:new", 1)).toBe(true);
  expect(c.items()[0].quantity).toBe(2);
  expect(c.sync.comparisonItems()![0].quantity).toBe(2);
  expect(await c.sync.clear()).toBe(true);
  expect(c.items()).toEqual([]);
  expect(c.request).toHaveBeenCalledTimes(1);
  expect(c.request.mock.calls[0][0]).toBe("/api/auth/me");
  expect(c.status).toHaveBeenLastCalledWith("guest");
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

it("quantity changes save without GET and retain the confirmed comparison input", async () => {
  const c = setup([], [row("milk", 1), row("eggs", 2)]);
  await c.sync.initialize();
  c.request.mockClear();
  await Promise.all([
    c.sync.quantity("green:milk", 1),
    c.sync.quantity("green:milk", 1),
  ]);
  expect(c.request.mock.calls.every((call) => call[1]?.method === "POST")).toBe(
    true,
  );
  expect(c.items().map((item) => item.quantity)).toEqual([3, 2]);
  expect(c.sync.comparisonItems()![0].quantity).toBe(3);
});
it("rolls back a rejected quantity save and requires refresh before further edits", async () => {
  const c = setup([], [row("milk", 1)]);
  await c.sync.initialize();
  c.request.mockRejectedValueOnce({ statusCode: 502 });
  expect(await c.sync.quantity("green:milk", 1)).toBe(false);
  expect(c.items()[0].quantity).toBe(1);
  expect(c.sync.comparisonItems()).toBeNull();
  expect(await c.sync.quantity("green:milk", 1)).toBe(false);
});

it("restores guest session, merges it on login and keeps account data out of guest storage", async () => {
  let items: Item[] = [];
  let guest = [row("guest", 2)];
  let stored = accountCartItems([row("remote")]);
  let loggedIn = false;
  const request = vi.fn(async (url: string, options?: any) => {
    if (url === "/api/auth/me") {
      if (!loggedIn) throw { statusCode: 401 };
      return {};
    }
    if (options?.method === "POST") {
      stored = options.body.items;
      return true;
    }
    return { items: structuredClone(stored) };
  });
  const sync = createCartSync({
    read: () => items,
    write: (rows) => {
      items = rows;
    },
    readGuest: () => guest,
    writeGuest: (rows) => {
      guest = rows;
    },
    request,
    status: vi.fn(),
    location: () => ({ lat: 53.9, lon: 27.5667, label: "Минск" }),
  });
  await sync.initialize();
  expect(items).toEqual(guest);
  await sync.mutate((current) => appendCartItems(current, [row("extra")]));
  expect(guest).toHaveLength(2);
  loggedIn = true;
  expect(await sync.login()).toBe(true);
  expect(stored.map((item) => item.id)).toEqual(["remote", "guest", "extra"]);
  expect(guest).toEqual([]);
  sync.logout();
  expect(items).toEqual([]);
  expect(sync.isGuest()).toBe(true);
});
