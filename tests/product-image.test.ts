import { describe, it, expect } from "vitest";
import { productImageUrl } from "../shared/product-image";
const base =
  "https://avatars.mds.yandex.net/get-eda/17770654/ff0a38050ac85e256f0a22eea7aa9ec5";
describe("Yandex product image renditions", () => {
  it("allows product images from the Sosedi storefront", () => {
    expect(productImageUrl("https://sosedi-dostavka.by/images/840994.jpg")).toBe(
      "https://sosedi-dostavka.by/images/840994.jpg",
    );
  });
  it("allows product images from the Edostavka catalog CDN", () => {
    expect(
      productImageUrl(
        "https://cdn.ime.by/UserFiles/images/catalog/Goods/8028/01328028/norm/01328028.n_1.png.webp?s=500x500",
      ),
    ).toBe(
      "/api/product-image?url=https%3A%2F%2Fcdn.ime.by%2FUserFiles%2Fimages%2Fcatalog%2FGoods%2F8028%2F01328028%2Fnorm%2F01328028.n_1.png.webp%3Fs%3D500x500",
    );
  });
  it("allows product images from the Green catalog CDN", () => {
    const url =
      "https://io.activecloud.com/static-green-market/138x138x2-1377283.jpg?id=12047&version=2";
    expect(productImageUrl(url)).toBe(url);
  });
  it.each(["", "/{w}x{h}", "/160x160", "/orig", "/"])(
    "uses the working original for %s",
    (suffix) => expect(productImageUrl(base + suffix)).toBe(base + "/orig"),
  );
  it.each([
    null,
    "broken",
    "https://evil.example/get-eda/1/id",
    "http://avatars.mds.yandex.net/get-eda/1/id",
    "https://avatars.mds.yandex.net/unknown",
    "https://user:pass@avatars.mds.yandex.net/get-eda/1/id",
  ])("rejects untrusted image %s", (value) =>
    expect(productImageUrl(value)).toBeNull(),
  );
});
