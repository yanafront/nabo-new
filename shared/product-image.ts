/** Normalizes trusted product images and proxies hosts blocked by browsers. */
export function productImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      url.hostname === "cdn.ime.by" &&
      !url.username &&
      !url.password &&
      !url.port &&
      /^\/UserFiles\/images\/catalog\/Goods\/[\w./-]+\.(?:png|jpe?g|webp)$/iu.test(
        url.pathname,
      )
    )
      return `/api/product-image?url=${encodeURIComponent(url.href)}`;
    if (
      url.protocol === "https:" &&
      url.hostname === "io.activecloud.com" &&
      !url.username &&
      !url.password &&
      !url.port &&
      /^\/static-green-market\/[\w.%()-]+$/iu.test(url.pathname) &&
      [...url.searchParams].every(
        ([key, item]) => ["id", "version"].includes(key) && /^\d+$/u.test(item),
      )
    )
      return url.href;
    if (
      url.protocol === "https:" &&
      url.hostname === "sosedi-dostavka.by" &&
      !url.username &&
      !url.password &&
      !url.port &&
      /^\/images\/[\w.-]+$/u.test(url.pathname)
    )
      return url.href;
    if (
      url.protocol !== "https:" ||
      url.hostname !== "avatars.mds.yandex.net" ||
      url.username ||
      url.password ||
      url.port
    )
      return null;
    const match = url.pathname.match(
      /^\/(get-eda|get-eda-images)\/(\d+)\/([\w-]+)(?:\/[^/]*)?\/?$/,
    );
    return match
      ? `https://avatars.mds.yandex.net/${match[1]}/${match[2]}/${match[3]}/orig`
      : null;
  } catch {
    return null;
  }
}
