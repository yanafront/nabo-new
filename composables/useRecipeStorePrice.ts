import type { Item } from "~/data/catalog";
import {
  retailStores,
  type SearchResult,
  type SearchBatchResult,
  type StoreId,
} from "~/shared/yandex";
import {
  recipePriceQuery,
  recipeStorePrice,
} from "~/shared/recipe-store-price";
export function useRecipeStorePrice(
  request: ComputedRef<{ items: Item[] } | null>,
) {
  const { location } = useRetail();
  const storeId = ref<StoreId>(retailStores[0].id);
  const cache = useState<Record<string, Record<string, SearchResult>>>(
    "recipe-price-search-cache",
    () => ({}),
  );
  const baseKey = computed(() =>
    JSON.stringify([storeId.value, location.value]),
  );
  const queries = computed(() =>
    [...new Set((request.value?.items || []).map(recipePriceQuery))].filter(
      Boolean,
    ),
  );
  const key = computed(() => JSON.stringify([baseKey.value, queries.value]));
  const loading = ref((request.value?.items.length || 0) > 0),
    error = ref(false);
  const estimate = computed(() =>
    recipeStorePrice(
      request.value?.items || [],
      cache.value[baseKey.value] || {},
    ),
  );
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let version = 0;
  async function load() {
    controller?.abort();
    const current = ++version;
    const cacheKey = baseKey.value;
    const wanted = queries.value;
    const selectedStore = storeId.value;
    const point = { ...location.value };
    const saved = { ...(cache.value[cacheKey] || {}) };
    const missing = wanted.filter(
      (query) => !saved[query] || saved[query].status !== "ok",
    );
    if (!missing.length) {
      loading.value = false;
      error.value = false;
      return;
    }
    loading.value = true;
    error.value = false;
    controller = new AbortController();
    const signal = controller.signal;
    try {
      for (let i = 0; i < missing.length; i += 20) {
        const chunk = missing.slice(i, i + 20);
        const result = await $fetch<SearchBatchResult>(
          "/api/yandex/search/batch",
          {
            method: "POST",
            body: { storeId: selectedStore, queries: chunk, location: point },
            signal,
            retry: 0,
            timeout: 70000,
          },
        );
        if (current !== version || signal.aborted) return;
        for (const [index, query] of chunk.entries()) {
          const item = result.items[index];
          if (item?.query === query && item.result?.storeId === selectedStore)
            saved[query] = item.result;
          else error.value = true;
        }
        cache.value = { ...cache.value, [cacheKey]: { ...saved } };
        const keys = Object.keys(cache.value);
        if (keys.length > 10) delete cache.value[keys[0]!];
      }
      error.value ||= wanted.some(
        (query) => !saved[query] || saved[query].status !== "ok",
      );
    } catch {
      if (current === version && !signal.aborted) error.value = true;
    } finally {
      if (current === version) loading.value = false;
    }
  }
  onMounted(() => {
    watch(
      key,
      () => {
        controller?.abort();
        ++version;
        clearTimeout(timer);
        loading.value = queries.value.length > 0;
        error.value = false;
        timer = setTimeout(load, 250);
      },
      { immediate: true },
    );
  });
  onBeforeUnmount(() => {
    ++version;
    controller?.abort();
    clearTimeout(timer);
  });
  return { storeId, estimate, loading, error, refresh: load };
}
