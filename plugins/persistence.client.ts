import { createCartSync } from "~/shared/cart-sync";
import { accountCartItems } from "~/shared/account-cart";
import { products, type Item } from "~/data/catalog";
import { retailStores } from "~/shared/yandex";
export default defineNuxtPlugin(() => {
  const { items, title, saved, notice, unresolved, pendingIngredients } =
    useBasket();
  const { location, invalidate } = useRetail();
  const syncState = useState<
    "guest" | "loading" | "saving" | "saved" | "error"
  >("cart-sync-state", () => "loading");
  const syncError = useState("cart-sync-error", () => "");
  const cartSync = createCartSync({
    read: () => items.value,
    write: (rows) => {
      items.value = rows;
    },
    location: () => location.value,
    request: (url, options) => $fetch(url, options),
    status: (state, error = "") => {
      syncState.value = state;
      syncError.value = error;
    },
  });
  onNuxtReady(() => {
    try {
      const data = JSON.parse(
        localStorage.getItem("nabo-v2") ||
          localStorage.getItem("nabo-v1") ||
          "null",
      );
      const valid = (rows: unknown): rows is Item[] =>
        Array.isArray(rows) &&
        rows.length <= 20 &&
        rows.every(
          (i) =>
            i &&
            typeof i.productId === "string" &&
            Number.isInteger(i.quantity) &&
            i.quantity > 0 &&
            i.quantity <= 99 &&
            (products.some((p) => p.id === i.productId) ||
              (i.product &&
                typeof i.product.name === "string" &&
                typeof i.product.unit === "string" &&
                typeof i.product.sourceId === "string" &&
                retailStores.some((s) => s.id === i.product.storeId) &&
                (i.product.price === null ||
                  (typeof i.product.price === "number" &&
                    Number.isFinite(i.product.price) &&
                    i.product.price > 0)))),
        );
      if (data) {
        if (Array.isArray(data.saved))
          saved.value = data.saved.filter(
            (s: any) =>
              s &&
              typeof s.id === "string" &&
              typeof s.title === "string" &&
              valid(s.items),
          );
        const loc = data.location;
        if (
          loc &&
          typeof loc.lat === "number" &&
          typeof loc.lon === "number" &&
          loc.lat >= 51 &&
          loc.lat <= 57 &&
          loc.lon >= 23 &&
          loc.lon <= 33 &&
          typeof loc.label === "string"
        )
          location.value = loc;
      }
    } catch {
      notice.value = "Не удалось восстановить сохранённые корзины";
    }
    void cartSync.initialize();
    watch(
      () =>
        JSON.stringify([
          accountCartItems(items.value),
          location.value.lat,
          location.value.lon,
        ]),
      invalidate,
      { flush: "sync" },
    );
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    let dirty = true;
    const persist = () => {
      clearTimeout(saveTimer);
      if (!dirty) return;
      try {
        localStorage.setItem(
          "nabo-v2",
          JSON.stringify({
            saved: saved.value,
            location: location.value,
          }),
        );
        dirty = false;
      } catch {
        notice.value =
          "Хранилище недоступно. Изменения сохранятся до закрытия страницы";
      }
    };
    persist(); // Drop legacy active-cart fields; only preferences and named lists stay local.
    const stop = watch(
      [items, title, saved, location, unresolved, pendingIngredients],
      () => {
        dirty = true;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(persist, 150);
      },
      { deep: true, flush: "sync" },
    );
    const hidden = () => {
      if (document.visibilityState === "hidden") persist();
    };
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", hidden);
    if (import.meta.hot)
      import.meta.hot.dispose(() => {
        persist();
        stop();
        window.removeEventListener("pagehide", persist);
        document.removeEventListener("visibilitychange", hidden);
      });
  });
  return { provide: { cartSync } };
});
