import { supportsStoreComparison } from "../../../shared/compare-capabilities";
// A legacy backend ignores unknown JSON properties. Never fan out until its
// published contract explicitly supports selecting a store.
const capabilities = new Map<string, { expires: number; perStore: boolean }>();
export default defineEventHandler(
  async (event): Promise<{ perStore: boolean }> => {
    setHeader(event, "cache-control", "no-store");
    const base = useRuntimeConfig(event).retailApiBase.replace(/\/+$/, "");
    const cached = capabilities.get(base);
    if (cached && cached.expires > Date.now())
      return { perStore: cached.perStore };
    let perStore = false;
    try {
      const doc: unknown = await $fetch<unknown>(`${base}/openapi/v1.json`, {
        timeout: 5000,
        retry: 0,
        redirect: "error",
      });
      perStore = supportsStoreComparison(doc);
    } catch {
      /* A failed capability lookup keeps the existing single-request flow. */
    }
    capabilities.set(base, { expires: Date.now() + 60000, perStore });
    return { perStore };
  },
);
