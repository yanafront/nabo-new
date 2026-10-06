import { afterEach, expect, it, vi } from "vitest";
import { useApi } from "../composables/useApi";
afterEach(() => vi.unstubAllGlobals());
it("resolves unique store/id pairs in batches of at most 200 without dropping individual statuses", async () => {
  vi.stubGlobal("useNuxtApp", () => ({}));
  const fetch = vi.fn(async (_url, options) => ({
    items: options.body.items.map((item: object) => ({ ...item, status: "not_found" })),
  }));
  vi.stubGlobal("$fetch", fetch);
  const items = Array.from({ length: 201 }, (_, i) => ({ storeId: "green" as const, id: String(i + 1) }));
  const location = { lat: 53.9, lon: 27.5667, label: "Минск" };
  const result = await useApi().resolveProducts({ items: [...items, items[0], { storeId: "sosedi", id: "1" }], location });
  expect(fetch.mock.calls.map(([, options]) => options.body.items.length)).toEqual([200, 2]);
  expect(fetch.mock.calls[0][0]).toBe("/api/products/resolve");
  expect(fetch.mock.calls[0][1].body.location).toEqual(location);
  expect(result.items).toHaveLength(202);
  expect(result.items.every((item) => item.status === "not_found")).toBe(true);
});
it("does not send an invalid empty resolve request", async () => {
  vi.stubGlobal("useNuxtApp", () => ({}));
  const fetch = vi.fn();
  vi.stubGlobal("$fetch", fetch);
  expect(await useApi().resolveProducts({ items: [], location: { lat: 53.9, lon: 27.5667, label: "Минск" } })).toEqual({ items: [] });
  expect(fetch).not.toHaveBeenCalled();
});
