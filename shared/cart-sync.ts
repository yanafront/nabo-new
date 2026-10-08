import type { Item } from "../data/catalog";
import type { AccountCartItem, DeliveryLocation } from "./yandex";
import {
  accountCartItems,
  restoredCartItems,
  savedCartCompareItems,
} from "./account-cart";
import { CartChangeError } from "./cart-actions";

/** Every edit uses a fresh server cart. Only getCart responses update the screen. */
export function createCartSync(options: {
  read: () => Item[];
  write: (items: Item[]) => void;
  location: () => DeliveryLocation;
  request: (url: string, options?: any) => Promise<any>;
  status: (
    state: "guest" | "loading" | "saving" | "saved" | "error",
    error?: string,
  ) => void;
}) {
  let authenticated = false;
  let generation = 0;
  let pending = 0;
  let queue: Promise<unknown> = Promise.resolve();
  let confirmed:
    | { items: AccountCartItem[]; signature: string; point: DeliveryLocation }
    | undefined;
  const fingerprint = () => JSON.stringify(accountCartItems(options.read()));
  async function authenticate() {
    if (!authenticated) {
      await options.request("/api/auth/me", { retry: 0, timeout: 15000 });
      authenticated = true;
    }
  }
  async function load(withPrices: boolean) {
    const point = { ...options.location() };
    const result = await options.request("/api/cart", {
      ...(withPrices ? { query: { lat: point.lat, lon: point.lon } } : {}),
      retry: 0,
      timeout: 120000,
    });
    if (!Array.isArray(result.items)) throw new Error("Invalid cart response");
    if (
      withPrices &&
      (point.lat !== options.location().lat ||
        point.lon !== options.location().lon)
    )
      throw new Error("Location changed");
    return {
      source: result.items as AccountCartItem[],
      rows: restoredCartItems(result.items),
      point,
    };
  }
  function failure(error: any) {
    confirmed = undefined;
    if ((error?.statusCode || error?.status) === 401) {
      authenticated = false;
      options.write([]);
      options.status(
        "guest",
        "Войдите в аккаунт, чтобы добавлять товары и сохранять корзину.",
      );
    } else
      options.status(
        "error",
        error instanceof CartChangeError
          ? error.message
          : "Не удалось обновить сохранённую корзину. Повторите попытку.",
      );
  }
  function enqueue(
    change?: (rows: Item[]) => Item[],
    clear = false,
  ): Promise<boolean> {
    const session = generation;
    pending++;
    confirmed = undefined;
    const task = queue
      .then(async () => {
        if (session !== generation) return false;
        options.status(change || clear ? "saving" : "loading");
        try {
          await authenticate();
          if (session !== generation) return false;
          if (change || clear) {
            const next = clear ? [] : change!((await load(false)).rows);
            if (session !== generation) return false;
            await options.request("/api/cart", {
              method: "POST",
              body: { items: accountCartItems(next) },
              retry: 0,
              timeout: 70000,
            });
          }
          if (session !== generation) return false;
          const loaded = await load(true);
          if (session !== generation) return false;
          options.write(loaded.rows);
          confirmed = {
            items: loaded.source,
            signature: fingerprint(),
            point: loaded.point,
          };
          options.status("saved");
          return true;
        } catch (error) {
          if (session === generation) failure(error);
          return false;
        }
      })
      .finally(() => {
        pending--;
      });
    queue = task;
    return task;
  }
  const refresh = () => enqueue();
  const mutate = (change: (rows: Item[]) => Item[]) => enqueue(change);
  const clear = () => enqueue(undefined, true);
  function logout() {
    generation++;
    authenticated = false;
    confirmed = undefined;
    options.write([]);
    options.status("guest");
  }
  function comparisonItems() {
    if (
      !authenticated ||
      pending ||
      !confirmed ||
      confirmed.signature !== fingerprint() ||
      confirmed.point.lat !== options.location().lat ||
      confirmed.point.lon !== options.location().lon
    )
      return null;
    return savedCartCompareItems(confirmed.items);
  }
  return {
    initialize: refresh,
    refresh,
    mutate,
    clear,
    logout,
    comparisonItems,
  };
}
