import { expect, it, vi } from "vitest";
import type { Item } from "../data/catalog";
import { createCartSync } from "../shared/cart-sync";
import { accountCartItems } from "../shared/account-cart";
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
    searchQuery: "Молоко",
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
    return { items: stored };
  });
  const sync = createCartSync({
    read: () => items,
    write: (value) => {
      items = value;
      sync.changed();
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
    set: (value: Item[]) => {
      items = value;
      sync.changed();
    },
  };
}
it("loads authenticated cart without resaving it or calling compare", async () => {
  const c = setup([row("old")], [row("remote", 2)]);
  await c.sync.initialize();
  expect(c.items()[0].productId).toBe("green:remote");
  expect(c.request.mock.calls.map((call) => call[0])).toEqual([
    "/api/auth/me",
    "/api/cart",
  ]);
  expect(c.request.mock.calls[1][1].query).toEqual({ lat: 53.9, lon: 27.5667 });
});
it("saves actual IDs, quantity edits and empty cart, then reloads via getCart", async () => {
  const c = setup();
  await c.sync.initialize();
  c.set([row("sku", 3)]);
  await c.sync.refresh();
  let writes = c.request.mock.calls.filter(
    (call) => call[1]?.method === "POST",
  );
  expect(writes[0][1].body.items[0]).toMatchObject({
    id: "sku",
    storeId: "green",
    count: 3,
  });
  expect(writes[0][1].body.items[0]).not.toHaveProperty("current");
  expect(writes[0][1].body.items[0]).not.toHaveProperty("price");
  expect(c.items()[0].product?.searchQuery).toBe("Молоко");
  c.set([]);
  await c.sync.refresh();
  writes = c.request.mock.calls.filter((call) => call[1]?.method === "POST");
  expect(writes.at(-1)![1].body.items).toEqual([]);
});
it("keeps guest carts local and does not call protected cart endpoints", async () => {
  const c = setup([row("guest")]);
  c.request.mockRejectedValue({ statusCode: 401 });
  await c.sync.initialize();
  c.set([row("guest", 2)]);
  await c.sync.refresh();
  expect(c.request.mock.calls.every((call) => call[0] === "/api/auth/me")).toBe(
    true,
  );
  expect(c.items()[0].quantity).toBe(2);
});
it("serializes edits while a save is in flight", async () => {
  const c = setup();
  await c.sync.initialize();
  let finish!: (value: boolean) => void;
  c.request.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  c.set([row("sku")]);
  c.set([row("sku", 4)]);
  finish(true);
  await c.sync.refresh();
  const writes = c.request.mock.calls.filter(
    (call) => call[1]?.method === "POST",
  );
  expect(writes.map((call) => call[1].body.items[0].count)).toEqual([1, 4]);
  expect(c.items()[0].quantity).toBe(4);
});
it("retains failed changes and offers a retry rather than applying stale cart", async () => {
  const c = setup();
  await c.sync.initialize();
  c.request.mockRejectedValueOnce({ statusCode: 502 });
  c.set([row("sku", 2)]);
  await c.sync.refresh();
  expect(c.items()[0].quantity).toBe(2);
  expect(c.status).toHaveBeenLastCalledWith("error", expect.any(String));
  await c.sync.refresh();
  expect(c.status).toHaveBeenLastCalledWith("saved");
});
it("does not overwrite a remote cart when adding during its initial load", async () => {
  const c = setup([], [row("existing")]);
  let finish!: (value: any) => void;
  c.request.mockImplementationOnce(async () => ({ id: "user" }));
  c.request.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const boot = c.sync.initialize();
  await Promise.resolve();
  c.set([row("new")]);
  finish({ items: accountCartItems([row("existing")]) });
  await boot;
  const writes = c.request.mock.calls.filter(
    (call) => call[1]?.method === "POST",
  );
  expect(writes[0][1].body.items.map((item: any) => item.id)).toEqual([
    "existing",
    "new",
  ]);
});

it("allows compare only from getCart after a successful save, using saved names rather than editorial queries", async () => {
  const c = setup();
  await c.sync.initialize();
  c.set([row("SKU", 2)]);
  expect(c.sync.comparisonItems()).toBeNull();
  await c.sync.refresh();
  expect(c.sync.comparisonItems()).toEqual([
    {
      id: "green:SKU",
      query: "SKU",
      exactName: "SKU",
      quantity: 2,
      unit: "1 л",
    },
  ]);
  expect(c.request.mock.calls.at(-1)?.[1]?.query).toEqual({
    lat: 53.9,
    lon: 27.5667,
  });
  c.request.mockRejectedValueOnce({ statusCode: 502 });
  c.set([row("SKU", 3)]);
  await c.sync.refresh();
  expect(c.sync.comparisonItems()).toBeNull();
});

it("compares the names and counts returned by getCart, even when they differ from the local selection", async () => {
  const c = setup();
  await c.sync.initialize();
  c.set([row("SKU", 2)]);
  await c.sync.refresh();
  c.request.mockResolvedValueOnce({
    items: [
      {
        id: "SKU",
        storeId: "green",
        name: "Название из сохранённой корзины",
        count: 5,
        unit: "500 г",
      },
    ],
  });
  await c.sync.refresh();
  expect(c.sync.comparisonItems()).toEqual([
    {
      id: "green:SKU",
      query: "Название из сохранённой корзины",
      exactName: "Название из сохранённой корзины",
      quantity: 5,
      unit: "500 г",
    },
  ]);
});
