import { retailStores } from "../yandex";
export interface SeoProductReference {
  storeId: string;
  id: string;
  name: string;
  unit?: string;
  image?: string;
  updatedAt?: string;
}
/** Only retailer-returned product identities, never queries or comparison row IDs. */
export function discoveredProducts(data: unknown): SeoProductReference[] {
  const found = new Map<string, SeoProductReference>();
  let visited = 0;
  function visit(value: any, depth = 0) {
    if (!value || typeof value !== "object" || depth > 8 || ++visited > 20000)
      return;
    if (Array.isArray(value)) {
      value.forEach((v) => visit(v, depth + 1));
      return;
    }
    if (
      retailStores.some((s) => s.id === value.storeId) &&
      typeof value.id === "string" &&
      value.id.trim() &&
      value.id.length <= 200 &&
      typeof value.name === "string" &&
      value.name.trim() &&
      value.name.length <= 500 &&
      typeof value.available === "boolean"
    ) {
      let image: string | undefined;
      if (typeof value.image === "string" && value.image.length <= 2048) {
        try {
          const url = new URL(value.image, "https://nabo.by");
          if (
            value.image.startsWith("/api/product-image?url=") ||
            (url.protocol === "https:" &&
              !url.username &&
              !url.password &&
              !value.image.startsWith("/"))
          )
            image = value.image;
        } catch {
          /* Invalid optional images do not block discovery. */
        }
      }
      found.set(JSON.stringify([value.storeId, value.id]), {
        storeId: value.storeId,
        id: value.id,
        name: value.name,
        unit:
          typeof value.unit === "string" && value.unit.length <= 200
            ? value.unit
            : "",
        ...(image ? { image } : {}),
      });
    }
    for (const key of ["products", "product", "stores", "items", "result"])
      visit(value[key], depth + 1);
  }
  visit(data);
  return [...found.values()];
}
