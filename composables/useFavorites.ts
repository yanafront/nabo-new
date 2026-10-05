import type { StoreId } from "~/shared/yandex";
export interface FavoriteReference {
  storeId: StoreId;
  id: string;
}
const loads = new WeakMap<object, Promise<void>>();
export function useFavorites() {
  const app = useNuxtApp();
  const favorites = useState<FavoriteReference[]>("favorites", () => []);
  const status = useState<"idle" | "loading" | "ready" | "guest" | "error">(
    "favorites-status",
    () => "idle",
  );
  const error = useState("favorites-error", () => "");
  const busy = useState<Record<string, boolean>>("favorites-busy", () => ({}));
  const generation = useState("favorites-generation", () => 0);
  const { notice } = useBasket();
  const { invalidate } = useRetail();
  const key = (p: FavoriteReference) => JSON.stringify([p.storeId, p.id]);
  const has = (p: FavoriteReference) =>
    favorites.value.some((f) => key(f) === key(p));
  function reset() {
    generation.value++;
    favorites.value = [];
    status.value = "idle";
    error.value = "";
    busy.value = {};
    loads.delete(app);
    invalidate();
  }
  async function load(force = false) {
    if (loads.has(app)) return loads.get(app);
    if (!force && ["ready", "guest", "error"].includes(status.value)) return;
    const epoch = generation.value;
    status.value = "loading";
    error.value = "";
    const request = (async () => {
      try {
        const result = await $fetch<FavoriteReference[]>("/api/favorites", {
          retry: 0,
          timeout: 15000,
        });
        if (epoch !== generation.value) return;
        favorites.value = result;
        status.value = "ready";
      } catch (e: any) {
        if (epoch !== generation.value) return;
        favorites.value = [];
        status.value = (e.statusCode || e.status) === 401 ? "guest" : "error";
        if (status.value === "error")
          error.value =
            "Не удалось загрузить любимые товары. Попробуйте ещё раз.";
      } finally {
        if (epoch === generation.value) loads.delete(app);
      }
    })();
    loads.set(app, request);
    return request;
  }
  async function toggle(
    product: FavoriteReference,
    returnTo = "/saved?tab=products",
  ) {
    const id = key(product);
    if (busy.value[id]) return;
    busy.value[id] = true;
    const epoch = generation.value;
    try {
      await load(status.value === "error");
      if (epoch !== generation.value) return;
      if (status.value === "guest") {
        notice.value = "Войдите, чтобы сохранить любимый товар.";
        await navigateTo({ path: "/account", query: { returnTo } });
        return;
      }
      if (status.value !== "ready") {
        notice.value = error.value;
        return;
      }
      const removing = has(product);
      await $fetch("/api/favorites", {
        method: removing ? "DELETE" : "PUT",
        body: { storeId: product.storeId, id: product.id },
        retry: 0,
        timeout: 15000,
      });
      if (epoch !== generation.value) return;
      favorites.value = removing
        ? favorites.value.filter((f) => key(f) !== id)
        : [...favorites.value, { storeId: product.storeId, id: product.id }];
      invalidate();
      notice.value = removing
        ? "Товар удалён из любимых"
        : "Товар добавлен в любимые";
    } catch (e: any) {
      if (epoch !== generation.value) return;
      if ((e.statusCode || e.status) === 401) {
        reset();
        status.value = "guest";
        notice.value = "Войдите, чтобы сохранить любимый товар.";
        await navigateTo({ path: "/account", query: { returnTo } });
      } else
        notice.value =
          "Не удалось изменить любимые товары. Попробуйте ещё раз.";
    } finally {
      if (epoch === generation.value) delete busy.value[id];
    }
  }
  return { favorites, status, error, busy, key, has, load, toggle, reset };
}
