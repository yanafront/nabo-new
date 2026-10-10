import type { RetailProduct, StoreId } from "~/shared/yandex";
export type ProductPreview = {
  storeId: StoreId;
  id: string;
  name?: string;
  replaceId?: string;
  product?: RetailProduct;
};
export function useProductPreview() {
  const selected = useState<ProductPreview | null>(
    "product-preview",
    () => null,
  );
  const open = (value: ProductPreview) => {
    selected.value = value;
  };
  const close = () => {
    selected.value = null;
  };
  return { selected, open, close };
}
