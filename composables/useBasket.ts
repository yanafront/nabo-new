import { appendCartItems, selectCartProduct } from "~/shared/cart-actions";
import { normalized } from "~/shared/recipe/model";
import { packagesFor } from "~/shared/recipe/purchasing";
import { products, type Item, type Product } from "~/data/catalog";
import type { CompareItem, RetailProduct } from "~/shared/yandex";
interface Saved {
  id: string;
  title: string;
  items: Item[];
  date: string;
}
export function useBasket() {
  const items = useState<Item[]>("items", () => []);
  const title = useState("basket-title", () => "Моя корзина");
  const saved = useState<Saved[]>("saved", () => []);
  const unresolved = useState<string[]>("unresolved-ingredients", () => []);
  const pendingIngredients = useState<Item[]>("pending-ingredients", () => []);
  const notice = useState("notice", () => "");
  const cartSync = useCartSync();
  const rows = computed(() =>
    items.value
      .map((i) => ({
        ...i,
        product: i.product!,
      }))
      .filter((i) => i.product?.sourceId),
  );
  const compareItems = computed<CompareItem[]>(() =>
    rows.value.map((i) => ({
      id: i.productId,
      query: i.product.name.slice(0, 160),
      quantity: i.quantity,
      unit: i.product.unit,
      ...(i.product.sourceId
        ? { exactName: i.product.name, unit: i.product.unit }
        : {}),
    })),
  );
  async function commit(change: (rows: Item[]) => Item[]) {
    const success = await cartSync.mutate(change);
    if (!success) {
      notice.value = cartSync.error.value;
      if (cartSync.state.value === "guest")
        await navigateTo({ path: "/account", query: { returnTo: "/basket" } });
    }
    return success;
  }
  async function addProducts(additions: Item[]) {
    return commit((current) => appendCartItems(current, additions));
  }
  async function addProduct(source: RetailProduct, replaceId?: string) {
    const success = await commit((current) =>
      selectCartProduct(current, source, replaceId),
    );
    if (!success) return false;
    const id = `${source.storeId}:${source.id}`;
    const matches = (name: string) => {
      const query = normalized(name),
        chosen = normalized(source.name);
      return chosen === query || chosen.startsWith(query + " ");
    };
    const addedQuantity =
      items.value.find((row) => row.productId === id)?.quantity || 0;
    pendingIngredients.value = pendingIngredients.value.filter((row) => {
      const query =
        row.requirement?.query ||
        row.product?.name ||
        products.find((p) => p.id === row.productId)?.name ||
        "";
      const needed = row.requirement
        ? packagesFor(source, row.requirement)
        : row.quantity;
      return !matches(query) || needed === undefined || addedQuantity < needed;
    });
    unresolved.value = unresolved.value.filter(
      (name) =>
        !matches(name) ||
        pendingIngredients.value.some(
          (row) =>
            normalized(row.requirement?.query || row.product?.name || "") ===
            normalized(name),
        ),
    );
    notice.value = replaceId ? "Товар заменён" : "Товар добавлен в корзину";
    return true;
  }
  async function remove(id: string) {
    return commit((current) => current.filter((row) => row.productId !== id));
  }
  async function change(id: string, delta: number) {
    if (
      (items.value.find((row) => row.productId === id)?.quantity || 0) +
        delta <=
      0
    )
      return remove(id);
    const success = await cartSync.quantity(id, delta);
    if (!success) notice.value = cartSync.error.value;
    return success;
  }

  const saving = useState("basket-saving", () => false);
  async function save() {
    if (!items.value.length || saving.value) return;
    saving.value = true;
    try {
      await $fetch("/api/auth/me", { retry: 0, timeout: 15000 });
    } catch (error: any) {
      if ((error.statusCode || error.status) === 401) {
        notice.value =
          "Войдите, чтобы сохранить список. Корзина останется на месте.";
        await navigateTo({ path: "/account", query: { returnTo: "/basket" } });
      } else {
        notice.value =
          "Не удалось проверить вход. Попробуйте сохранить ещё раз.";
      }
      return;
    } finally {
      saving.value = false;
    }
    if (!items.value.length) return;
    const signature = (rows: Item[]) =>
      JSON.stringify(
        rows
          .map((row) => [row.productId, row.quantity] as const)
          .sort((a, b) => a[0].localeCompare(b[0])),
      );
    const current = signature(items.value);
    if (saved.value.some((list) => signature(list.items) === current)) {
      notice.value = "Такая подборка уже есть в сохранённом";
      return;
    }
    saved.value.unshift({
      id: crypto.randomUUID(),
      title: title.value,
      items: JSON.parse(JSON.stringify(items.value)),
      date: new Date().toLocaleDateString("ru-BY"),
    });
    notice.value = "Список сохранён в разделе «Сохранённое»";
  }
  async function clear() {
    if (!(await cartSync.clear())) {
      notice.value = cartSync.error.value;
      return false;
    }
    unresolved.value = [];
    pendingIngredients.value = [];
    title.value = "Моя корзина";
    notice.value = "Корзина очищена";
    return true;
  }
  return {
    items,
    title,
    saved,
    notice,
    rows,
    compareItems,
    unresolved,
    pendingIngredients,
    addProduct,
    addProducts,
    remove,
    change,
    save,
    saving,
    clear,
  };
}
