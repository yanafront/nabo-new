export const retailStores = [
  {
    id: "evroopt",
    name: "Евроопт",
    slug: "evroopt",
    color: "#e53935",
    letter: "е",
    provider: "edostavka",
  },
  {
    id: "green",
    name: "Green",
    slug: "green",
    color: "#55a630",
    letter: "g",
    provider: "green",
  },
  {
    id: "gippo",
    name: "Гиппо",
    slug: "gippo_plqer",
    color: "#eb7b27",
    letter: "г",
    provider: "yandex",
  },
  {
    id: "sosedi",
    name: "Соседи",
    slug: "sosedi",
    color: "#f58220",
    letter: "с",
    provider: "sosedi",
  },
  {
    id: "belmarket",
    name: "Белмаркет",
    slug: "belmarket",
    color: "#df253f",
    letter: "б",
    provider: "yandex",
  },
  {
    id: "santa",
    name: "Санта",
    slug: "santa_by",
    color: "#225bcc",
    letter: "с",
    provider: "yandex",
  },
] as const;
export type StoreId = (typeof retailStores)[number]["id"];
export interface DeliveryLocation {
  lat: number;
  lon: number;
  label: string;
}
export interface ProductResult {
  storeId: StoreId;
  id: string;
  status: "ok" | "not_found" | "error";
  product: RetailProduct | null;
  fetchedAt: string;
  error?: string | null;
}
export interface AccountCartItem {
  id: string;
  storeId: StoreId;
  name: string;
  count: number;
  image?: string | null;
  unit?: string | null;
  current?: ProductResult;
}
export interface RetailProduct {
  id: string;
  storeId: StoreId;
  placeSlug: string;
  name: string;
  categories?: Array<{ id: string | null; name: string | null }>;
  description?: string;
  rating?: string;
  unit: string;
  price: number;
  oldPrice: number | null;
  image: string | null;
  stock: number | null;
  available: boolean;
  fetchedAt: string;
  externalUrl?: string;
}
export interface SearchResult {
  storeId: StoreId;
  placeSlug: string;
  status: "ok" | "error";
  products: RetailProduct[];
  error?: string;
  fetchedAt: string;
  currency: "BYN";
}
export interface SearchAllResult {
  stores: SearchResult[];
}
export interface CompareItem {
  id: string;
  query: string;
  quantity: number;
  exactName?: string;
  unit?: string;
}
export interface CompareLine {
  demand?: import("./recipe/purchasing").IngredientDemand;
  replacement?: boolean;
  itemId: string;
  query: string;
  quantity: number;
  selected: RetailProduct | null;
  alternatives: RetailProduct[];
  error?: string;
}
export interface StoreComparison {
  storeId: StoreId;
  placeSlug: string;
  lines: CompareLine[];
  fetchedAt: string;
}
export const storeUrl = (id: StoreId) =>
  id === "sosedi"
    ? "https://sosedi-dostavka.by/"
    : id === "evroopt"
      ? "https://edostavka.by/"
      : id === "green"
        ? "https://green-dostavka.by/"
        : `https://eda.yandex.by/retail/${retailStores.find((s) => s.id === id)!.slug}`;

export const productUrl = (storeId: StoreId, productId: string) =>
  storeId === "sosedi"
    ? `${storeUrl(storeId)}search?query=${encodeURIComponent(productId)}`
    : storeId === "evroopt"
      ? `${storeUrl(storeId)}product/${encodeURIComponent(productId)}`
      : storeId === "green"
        ? `${storeUrl(storeId)}search?query=${encodeURIComponent(productId)}`
        : `${storeUrl(storeId)}?item=${encodeURIComponent(productId)}`;

export const productSourceUrl = (
  product: Pick<RetailProduct, "id" | "storeId" | "externalUrl">,
) => product.externalUrl || productUrl(product.storeId, product.id);

export const providerName = (storeId: StoreId) =>
  storeId === "sosedi"
    ? "Соседи"
    : storeId === "evroopt"
      ? "Е-доставка"
      : storeId === "green"
        ? "Green"
        : "Яндекс Еда";
