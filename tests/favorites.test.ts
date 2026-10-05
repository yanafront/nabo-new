import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ref } from "vue";
import { useFavorites } from "../composables/useFavorites";
import { authReturnPath } from "../shared/auth-return";
let fetchMock: ReturnType<typeof vi.fn>;
let invalidate: ReturnType<typeof vi.fn>;
beforeEach(() => {
  const states = new Map();
  const app = {};
  vi.stubGlobal("useNuxtApp", () => app);
  vi.stubGlobal("useState", (key: string, initial: () => unknown) => {
    if (!states.has(key)) states.set(key, ref(initial()));
    return states.get(key);
  });
  const notice = ref("");
  invalidate = vi.fn();
  vi.stubGlobal("useBasket", () => ({ notice }));
  vi.stubGlobal("useRetail", () => ({ invalidate }));
  fetchMock = vi.fn().mockResolvedValue([]);
  vi.stubGlobal("$fetch", fetchMock);
  vi.stubGlobal("navigateTo", vi.fn());
});
afterEach(() => vi.unstubAllGlobals());
const product = { storeId: "green" as const, id: "12" };
it("deduplicates list requests from many cards", async () => {
  await Promise.all([
    useFavorites().load(),
    useFavorites().load(),
    useFavorites().load(),
  ]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it("requires login and never sends a guest mutation", async () => {
  fetchMock.mockRejectedValue({ statusCode: 401 });
  const favorites = useFavorites();
  await favorites.toggle(product, "/products?q=milk");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(favorites.favorites.value).toEqual([]);
  expect(navigateTo).toHaveBeenCalledWith({
    path: "/account",
    query: { returnTo: "/products?q=milk" },
  });
});
it("uses PUT and DELETE with only the exact product reference", async () => {
  const favorites = useFavorites();
  await favorites.load();
  await favorites.toggle(product);
  expect(fetchMock).toHaveBeenLastCalledWith(
    "/api/favorites",
    expect.objectContaining({ method: "PUT", body: product }),
  );
  expect(favorites.has(product)).toBe(true);
  expect(favorites.has({ ...product, storeId: "sosedi" })).toBe(false);
  await favorites.toggle(product);
  expect(fetchMock).toHaveBeenLastCalledWith(
    "/api/favorites",
    expect.objectContaining({ method: "DELETE", body: product }),
  );
  expect(favorites.has(product)).toBe(false);
  expect(invalidate).toHaveBeenCalledTimes(2);
});
it("does not show a successful like when the server failed", async () => {
  const favorites = useFavorites();
  await favorites.load();
  fetchMock.mockRejectedValue({ statusCode: 500 });
  await favorites.toggle(product);
  expect(favorites.has(product)).toBe(false);
  expect(favorites.busy.value).toEqual({});
});
it("keeps a favorite if deletion fails", async () => {
  fetchMock.mockResolvedValue([product]);
  const favorites = useFavorites();
  await favorites.load();
  fetchMock.mockRejectedValue({ statusCode: 500 });
  await favorites.toggle(product);
  expect(favorites.has(product)).toBe(true);
});
it("ignores old account responses after logout", async () => {
  let resolve!: (value: unknown) => void;
  fetchMock.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const favorites = useFavorites();
  const loading = favorites.load();
  favorites.reset();
  resolve([product]);
  await loading;
  expect(favorites.favorites.value).toEqual([]);
  expect(favorites.status.value).toBe("idle");
});
it("prevents duplicate concurrent mutations on the same item", async () => {
  const favorites = useFavorites();
  await favorites.load();
  let resolve!: () => void;
  fetchMock.mockImplementation(
    () =>
      new Promise<void>((r) => {
        resolve = r;
      }),
  );
  const first = favorites.toggle(product);
  await Promise.resolve();
  await Promise.resolve();
  await favorites.toggle(product);
  resolve();
  await first;
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(favorites.favorites.value).toEqual([product]);
});
it.each([
  "https://evil.test",
  "//evil.test",
  "/\\evil.test",
  "/account",
  "javascript:alert(1)",
])("rejects unsafe login return %s", (path) =>
  expect(authReturnPath(path)).toBeNull(),
);
it.each([
  "/saved?tab=products",
  "/products?q=milk&store=green",
  "/product/green/12?name=milk",
  "/basket",
])("preserves safe login return %s", (path) =>
  expect(authReturnPath(path)).toBe(path),
);
