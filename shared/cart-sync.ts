import type { Item } from "../data/catalog";
import type { AccountCartItem, DeliveryLocation } from "./yandex";
import {
  accountCartItems,
  restoredCartItems,
  savedCartCompareItems,
} from "./account-cart";
import { CartChangeError } from "./cart-actions";

/** Structural edits reload the server cart; quantity edits reuse its confirmed snapshot. */
export function createCartSync(options: {
  read: () => Item[];
  write: (items: Item[]) => void;
  location: () => DeliveryLocation;
  request: (url: string, options?: any) => Promise<any>;
  status: (
    state: "guest" | "loading" | "saving" | "updating" | "saved" | "error",
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
        const previous = options.read();
        let posted = false;
        options.status(change || clear ? "saving" : "loading");
        try {
          if ((change || clear) && authenticated)
            options.write(clear ? [] : change!(previous));
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
            posted = true;
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
          if (session === generation) {
            if ((change || clear) && !posted) options.write(previous);
            failure(error);
          }
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
  function quantity(id: string, delta: number): Promise<boolean> {
    const session = generation;
    pending++;
    const task = queue
      .then(async () => {
        if (session !== generation) return false;
        const previous = options.read();
        const snapshot = confirmed;
        try {
          if (
            !authenticated ||
            !snapshot ||
            snapshot.signature !== fingerprint()
          )
            throw new CartChangeError(
              "Обновите корзину перед изменением количества.",
            );
          const next = previous.map((row) => {
            if (row.productId !== id) return row;
            const count = row.quantity + delta;
            if (!Number.isInteger(count) || count < 1 || count > 99)
              throw new CartChangeError(
                "Количество должно быть от 1 до 99 упаковок.",
              );
            const { requirement, ...selected } = row;
            return { ...selected, quantity: count };
          });
          options.status("updating");
          options.write(next);
          await options.request("/api/cart", {
            method: "POST",
            body: { items: accountCartItems(next) },
            retry: 0,
            timeout: 70000,
          });
          if (session !== generation) return false;
          confirmed = {
            ...snapshot,
            items: snapshot.items.map((item) => ({
              ...item,
              count: next.find(
                (row) => row.productId === item.storeId + ":" + item.id,
              )!.quantity,
            })),
            signature: fingerprint(),
          };
          options.status("saved");
          return true;
        } catch (error) {
          if (session === generation) {
            options.write(previous);
            failure(error);
          }
          return false;
        }
      })
      .finally(() => {
        pending--;
      });
    queue = task;
    return task;
  }
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
    quantity,
    clear,
    logout,
    comparisonItems,
  };
}
