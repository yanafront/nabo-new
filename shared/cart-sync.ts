import type { Item } from "../data/catalog";
import type { AccountCartItem, DeliveryLocation } from "./yandex";
import { accountCartItems, restoredCartItems } from "./account-cart";

/** Serializes writes: an older request must never overwrite a later edit. */
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
  let initialized = false;
  let muted = false;
  let dirty = false;
  let generation = 0;
  let running: Promise<void> | undefined;
  let initializing: Promise<void> | undefined;
  const fingerprint = () => JSON.stringify(accountCartItems(options.read()));
  const apply = (items: Item[]) => {
    muted = true;
    try {
      options.write(items);
    } finally {
      muted = false;
    }
  };
  const restore = (rows: AccountCartItem[]): Item[] =>
    restoredCartItems(rows).map((row) => {
      const previous = options
        .read()
        .find((item) => item.productId === row.productId);
      return {
        ...row,
        requirement: previous?.requirement,
        product: {
          ...row.product!,
          searchQuery:
            previous?.product?.searchQuery || previous?.requirement?.query,
        },
      };
    });
  async function load() {
    const point = { ...options.location() };
    const result = await options.request("/api/cart", {
      query: { lat: point.lat, lon: point.lon },
      retry: 0,
      timeout: 120000,
    });
    if (!Array.isArray(result.items)) throw new Error("Invalid cart");
    if (
      point.lat !== options.location().lat ||
      point.lon !== options.location().lon
    )
      throw new Error("Location changed");
    return restore(result.items);
  }
  function failure(error: any) {
    if ((error?.statusCode || error?.status) === 401) {
      authenticated = false;
      initialized = false;
      options.status("guest");
    } else
      options.status(
        "error",
        "Не удалось синхронизировать корзину. Изменения остаются на устройстве. Повторите попытку.",
      );
  }
  function changed() {
    if (muted) return;
    dirty = true;
    if (initialized && authenticated) void flush();
  }
  async function flush(): Promise<void> {
    if (running) return running;
    if (!authenticated || !initialized) return;
    const session = generation;
    running = (async () => {
      try {
        do {
          while (dirty && session === generation) {
            dirty = false;
            options.status("saving");
            await options.request("/api/cart", {
              method: "POST",
              body: { items: accountCartItems(options.read()) },
              retry: 0,
              timeout: 70000,
            });
          }
          if (session !== generation) return;
          const before = fingerprint();
          const rows = await load();
          if (session !== generation) return;
          if (!dirty && before === fingerprint()) apply(rows);
        } while (dirty);
        options.status("saved");
      } catch (error) {
        if (session === generation) {
          dirty = true;
          failure(error);
        }
      }
    })();
    try {
      await running;
    } finally {
      running = undefined;
    }
  }
  async function initialize(mergeGuest = false): Promise<void> {
    if (initializing) return initializing;
    const session = generation;
    const before = JSON.parse(JSON.stringify(options.read())) as Item[];
    options.status("loading");
    initialized = false;
    initializing = (async () => {
      try {
        await options.request("/api/auth/me", { retry: 0, timeout: 15000 });
        if (session !== generation) return;
        authenticated = true;
        const remote = await load();
        if (session !== generation) return;
        const current = options.read();
        const changedDuringLoad =
          JSON.stringify(accountCartItems(before)) !== fingerprint();
        const remoteSignature = JSON.stringify(accountCartItems(remote));
        let next = remote;
        if (changedDuringLoad) {
          // Replay edits made while loading against the remote cart.
          next = remote.map((row) => ({ ...row }));
          if (!current.length) next = [];
          else
            for (const id of new Set(
              [...before, ...current].map((row) => row.productId),
            )) {
              const old = before.find((row) => row.productId === id);
              const edited = current.find((row) => row.productId === id);
              const delta = (edited?.quantity || 0) - (old?.quantity || 0);
              if (!delta) continue;
              const existing = next.find((row) => row.productId === id);
              const quantity = (existing?.quantity || 0) + delta;
              next = next.filter((row) => row.productId !== id);
              if (quantity > 0 && (edited || existing))
                next.push({
                  ...(edited || existing)!,
                  quantity: Math.min(99, quantity),
                });
            }
        } else if (mergeGuest) {
          for (const row of current) {
            const existing = next.find(
              (item) => item.productId === row.productId,
            );
            if (existing)
              existing.quantity = Math.max(existing.quantity, row.quantity);
            else next.push(row);
          }
        }
        if (next.length > 200) throw new Error("Cart too large");
        dirty =
          changedDuringLoad ||
          (mergeGuest &&
            JSON.stringify(accountCartItems(next)) !== remoteSignature);
        apply(next);
        initialized = true;
        if (dirty) await flush();
        else options.status("saved");
      } catch (error) {
        if (session === generation) failure(error);
      }
    })();
    try {
      await initializing;
    } finally {
      initializing = undefined;
    }
  }
  async function refresh() {
    if (!initialized) return initialize();
    return flush();
  }
  function logout() {
    generation++;
    authenticated = false;
    initialized = false;
    dirty = false;
    apply([]);
    options.status("guest");
  }
  return { changed, initialize, refresh, logout };
}
