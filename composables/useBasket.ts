import { normalized } from "~/shared/recipe/model";
import { packagesFor } from "~/shared/recipe/purchasing";
import { retailProduct } from "~/shared/recipe-basket";
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
  function addProduct(source: RetailProduct, replaceId?: string) {
    if (!source.available) {
      notice.value = "Товар сейчас недоступен";
      return false;
    }
    const product = retailProduct(source);
    const id = product.id;
    const old = replaceId
      ? items.value.find((i) => i.productId === replaceId)
      : undefined;
    const existing = items.value.find((i) => i.productId === id);
    if (old === existing && old) return true;
    if (replaceId && !old) {
      notice.value = "Товар для замены уже удалён";
      return false;
    }
    const quantity = (existing?.quantity || 0) + (old?.quantity || 1);
    if (quantity > 99 || (source.stock !== null && quantity > source.stock)) {
      notice.value = "Больше нет в наличии";
      return false;
    }
    if (!old && !existing && items.value.length >= 20) {
      notice.value = "В корзине может быть до 20 позиций";
      return false;
    }
    if (existing) {
      if (old) {
        existing.required = existing.required || old.required;
        if (old.allowReplacement === false) existing.allowReplacement = false;
      }
      delete existing.requirement;
      existing.quantity = quantity;
      existing.product = product;
      if (old) remove(old.productId);
    } else if (old) {
      delete old.requirement;
      old.productId = id;
      old.product = product;
    } else items.value.push({ productId: id, quantity: 1, product });
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
  function remove(id: string) {
    items.value = items.value.filter((i) => i.productId !== id);
  }
  function change(id: string, delta: number) {
    const i = items.value.find((i) => i.productId === id);
    if (i) {
      if (i.product && i.requirement?.query)
        i.product.searchQuery ||= i.requirement.query;
      delete i.requirement; // A manual pack count replaces the recipe demand.
      if (i.quantity + delta <= 0) {
        remove(id);
        notice.value = "Товар удалён из корзины";
      } else i.quantity = Math.min(99, i.quantity + delta);
    }
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
  function clear() {
    items.value = [];
    unresolved.value = [];
    pendingIngredients.value = [];
    title.value = "Моя корзина";
    notice.value = "Корзина очищена";
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
    remove,
    change,
    save,
    saving,
    clear,
  };
}
