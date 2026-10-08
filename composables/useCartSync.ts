export function useCartSync() {
  const state = useState<"guest" | "loading" | "saving" | "saved" | "error">(
    "cart-sync-state",
    () => "loading",
  );
  const error = useState("cart-sync-error", () => "");
  const app = useNuxtApp();
  const controller = () => app.$cartSync;
  return {
    state,
    error,
    refresh: () => controller()?.refresh(),
    comparisonItems: () => controller()?.comparisonItems() || null,
    login: () => controller()?.initialize(),
    mutate: (
      change: (
        rows: import("~/data/catalog").Item[],
      ) => import("~/data/catalog").Item[],
    ) => controller().mutate(change),
    clear: () => controller().clear(),
    logout: () => controller()?.logout(),
  };
}
