export function authReturnPath(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/")) return null;
  try {
    const url = new URL(value, "https://nabo.invalid");
    if (url.origin !== "https://nabo.invalid") return null;
    if (
      !["/basket", "/products", "/saved"].includes(url.pathname) &&
      !/^\/product\/[^/]+\/[^/]+$/.test(url.pathname)
    )
      return null;
    return url.pathname + url.search;
  } catch {
    return null;
  }
}
