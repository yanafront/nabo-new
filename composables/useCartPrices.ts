export function useCartPrices() {
  const cartSync = useCartSync();
  const pending = ref(false);
  const error = ref("");
  async function refreshPrices() {
    if (pending.value) return;
    pending.value = true;
    error.value = "";
    try {
      await cartSync.refresh();
      error.value = cartSync.error.value;
    } finally {
      pending.value = false;
    }
  }
  return { refreshPrices, pricesPending: pending, pricesError: error };
}
