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
    comparisons.value
      .map((offer) => {
        const store = retailStores.find((s) => s.id === offer.storeId)!;
        return { ...offer, ...store, ...summarizeComparison(offer) };
      })
      .sort(
        (a, b) =>
          Number(b.complete) - Number(a.complete) || a.subtotal - b.subtotal,
      ),
  );
  async function compare(items: CompareItem[]) {
    if (!items.length) return;
    requests.get(app)?.abort();
    const controller = new AbortController();
    requests.set(app, controller);
    const key = keyFor(items);
    const requestId = crypto.randomUUID();
    currentKey.value = requestId;
    pending.value = true;
    error.value = "";
    comparisons.value = [];
    fingerprint.value = "";
    try {
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
    keyFor,
    fingerprint,
  };
}
