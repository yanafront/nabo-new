import { summarizeComparison } from "~/shared/comparison";
import type {
  DeliveryLocation,
  CompareItem,
  StoreComparison,
} from "~/shared/yandex";
import { retailStores } from "~/shared/yandex";
const requests = new WeakMap<object, AbortController>();
export function useRetail() {
  const app = useNuxtApp();
  const location = useState<DeliveryLocation>("delivery-location", () => ({
    lat: 53.9,
    lon: 27.5667,
    label: "Минск, центр",
  }));
  const comparisons = useState<StoreComparison[]>(
    "retail-comparisons",
    () => [],
  );
  const pending = useState("retail-pending", () => false);
  const error = useState("retail-error", () => "");
  const fingerprint = useState("retail-fingerprint", () => "");
  const currentKey = useState("retail-request-key", () => "");
  const keyFor = (items: CompareItem[]) =>
    JSON.stringify([items, location.value.lat, location.value.lon]);
  const offers = computed(() =>
    comparisons.value.map((offer) => {
      const store = retailStores.find((s) => s.id === offer.storeId)!;
      return { ...offer, ...store, ...summarizeComparison(offer) };
    }),
  );
  async function compare(refreshCart = true) {
    requests.get(app)?.abort();
    const controller = new AbortController();
    requests.set(app, controller);

    const requestId = crypto.randomUUID();
    currentKey.value = requestId;
    pending.value = true;
    error.value = "";
    fingerprint.value = "";
    try {
      if (refreshCart) await app.$cartSync.refresh();
      if (controller.signal.aborted) return;
      const items = app.$cartSync.comparisonItems();
      if (!items) {
        error.value =
          "Для сравнения нужна сохранённая корзина. Войдите в аккаунт или повторите сохранение корзины.";
        return;
      }
      if (!items.length) return;
      const key = keyFor(items);
      const result = await $fetch<{ offers: StoreComparison[] }>(
        "/api/yandex/compare",
        {
          method: "POST",
          body: { items, location: location.value },
          signal: controller.signal,
          timeout: 120000,
          retry: 0,
        },
      );
      if (currentKey.value !== requestId) return;
      comparisons.value = result.offers;
      fingerprint.value = key;
    } catch {
      if (currentKey.value === requestId)
        error.value =
          "Не удалось получить сравнение. Проверьте соединение и повторите.";
    } finally {
      if (currentKey.value === requestId) pending.value = false;
    }
  }
  function updateDraft(rows: import("~/data/catalog").Item[]) {
    if (!comparisons.value.length) return;
    comparisons.value = comparisons.value.map((offer) => {
      const lines = offer.lines.map((line) => ({
        ...line,
        quantity:
          rows.find((row) => row.productId === line.itemId)?.quantity ||
          line.quantity,
      }));
      for (const row of rows) {
        if (lines.some((line) => line.itemId === row.productId)) continue;
        const product = row.product;
        const cached = offer.lines
          .flatMap((line) => [line.selected, ...line.alternatives])
          .find(
            (candidate) =>
              candidate &&
              candidate.id === product?.sourceId &&
              candidate.storeId === offer.storeId,
          );
        const selected =
          cached ||
          (product?.storeId === offer.storeId &&
          product.sourceId &&
          product.price !== null &&
          product.refreshStatus !== "not_found"
            ? {
                id: product.sourceId,
                storeId: offer.storeId,
                name: product.name,
                price: product.price,
                unit: product.unit,
                image: product.image || null,
                available: true,
                stock: null,
                oldPrice: null,
                placeSlug: offer.placeSlug,
                fetchedAt: product.fetchedAt || offer.fetchedAt,
              }
            : null);
        lines.push({
          itemId: row.productId,
          query: product?.name || "",
          quantity: row.quantity,
          selected,
          alternatives: [],
        });
      }
      return { ...offer, lines };
    });
    fingerprint.value = "";
  }
  function updateQuantities(items: CompareItem[]) {
    if (!comparisons.value.length || pending.value) {
      invalidate();
      return;
    }
    comparisons.value = comparisons.value.map((offer) => ({
      ...offer,
      lines: offer.lines.map((line) => ({
        ...line,
        quantity:
          items.find((item) => item.id === line.itemId)?.quantity ||
          line.quantity,
      })),
    }));
    fingerprint.value = keyFor(items);
  }
  function invalidate() {
    requests.get(app)?.abort();
    requests.delete(app);
    currentKey.value = "";
    comparisons.value = [];
    fingerprint.value = "";
    pending.value = false;
  }
  return {
    location,
    comparisons,
    offers,
    pending,
    error,
    compare,
    invalidate,
    updateQuantities,
    updateDraft,
    keyFor,
    fingerprint,
  };
}
