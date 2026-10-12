/** Tag navigation URLs only; image and API URLs must stay unchanged. */
export function outboundUrl(href: string, origin: string): string {
  try {
    const url = new URL(href, origin);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.origin === new URL(origin).origin
    )
      return href;
    url.searchParams.set("utm_source", "nabo");
    url.searchParams.set("utm_medium", "referral");
    url.searchParams.set("utm_campaign", "outbound");
    return url.href;
  } catch {
    return href;
  }
}
