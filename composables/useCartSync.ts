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
    login: () => controller()?.initialize(true),
    logout: () => controller()?.logout(),
  };
}
