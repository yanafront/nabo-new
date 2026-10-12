import { describe, expect, it } from "vitest";
import { outboundUrl } from "../shared/outbound-url";
const origin = "https://nabo-new.vercel.app";
describe("outbound link attribution", () => {
  it("tags external navigation while preserving product, map and fragment parameters", () => {
    const result = new URL(
      outboundUrl("https://yandex.by/maps/?pt=27.5,53.9&z=17#place", origin),
    );
    expect(result.searchParams.get("pt")).toBe("27.5,53.9");
    expect(result.searchParams.get("z")).toBe("17");
    expect(result.hash).toBe("#place");
    expect(result.searchParams.get("utm_source")).toBe("nabo");
    expect(result.searchParams.get("utm_medium")).toBe("referral");
    expect(result.searchParams.get("utm_campaign")).toBe("outbound");
  });
  it("keeps internal and non-web links unchanged", () => {
    for (const href of [
      "/basket",
      "#recipe-ready-offers",
      `${origin}/recipes`,
      "mailto:test@example.com",
      "tel:+375290000000",
      "javascript:void(0)",
      "https://[bad",
    ])
      expect(outboundUrl(href, origin)).toBe(href);
  });
  it("replaces previous attribution and remains idempotent", () => {
    const result = outboundUrl(
      "https://delivio.by/search?type=1&q=сырники&utm_source=old&utm_source=duplicate&utm_content=dish",
      origin,
    );
    const url = new URL(result);
    expect(url.searchParams.getAll("utm_source")).toEqual(["nabo"]);
    expect(url.searchParams.get("utm_content")).toBe("dish");
    expect(url.searchParams.get("q")).toBe("сырники");
    expect(outboundUrl(result, origin)).toBe(result);
  });
  it("tags protocol-relative external links", () => {
    expect(
      new URL(
        outboundUrl("//edostavka.by/product/123", origin),
      ).searchParams.get("utm_source"),
    ).toBe("nabo");
  });
});
