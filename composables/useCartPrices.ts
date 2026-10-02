import { refreshedItem } from "~/shared/account-cart";
export function useCartPrices() {
  const { items, notice } = useBasket();
  const { location } = useRetail();
  const { resolveProducts } = useApi();
  const pending = ref(false);
  const error = ref("");
  let controller: AbortController | undefined;
  async function refreshPrices() {
    if (pending.value || !items.value.length) return;
    const point = { ...location.value };
    const references = items.value.flatMap((item) =>
      item.product?.storeId && item.product.sourceId
        ? [{ storeId: item.product.storeId, id: item.product.sourceId }]
        : [],
    );
    if (!references.length) return;
    controller = new AbortController();
    pending.value = true;
    error.value = "";
    try {
      const result = await resolveProducts(
        { items: references, location: point },
        controller.signal,
      );
      if (
        point.lat !== location.value.lat ||
        point.lon !== location.value.lon
      ) {
        error.value = "Точка доставки изменилась. Обновите цены ещё раз.";
        return;
      }
      items.value = items.value.map((item) =>
        refreshedItem(
          item,
          result.items.find(
            (entry) =>
              entry.id === item.product?.sourceId &&
              entry.storeId === item.product?.storeId,
          ),
        ),
      );
      const missing = items.value.filter(
        (item) => item.product?.refreshStatus !== "ok",
      ).length;
      notice.value = missing
        ? `Цены обновлены. Для ${missing} позиций цена не подтверждена.`
        : "Цены корзины обновлены";
    } catch (e: any) {
      if (!controller.signal.aborted)
        error.value =
          e.statusCode === 429
            ? "Слишком много запросов. Повторите через минуту."
            : "Не удалось обновить цены. Повторите попытку.";
    } finally {
      pending.value = false;
    }
  }
  onBeforeUnmount(() => controller?.abort());
  return { refreshPrices, pricesPending: pending, pricesError: error };
}
