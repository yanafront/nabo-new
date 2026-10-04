import { describe, expect, it } from "vitest";
import {
  deliveryPolicies,
  estimateDelivery,
  totalWithEnteredFees,
} from "../shared/delivery";
import { retailStores } from "../shared/yandex";
describe("Published delivery estimates", () => {
  it("covers every actual catalogue provider", () => {
    expect(Object.keys(deliveryPolicies).sort()).toEqual(
      retailStores.map((s) => s.id).sort(),
    );
  });
  it("adds Sosedi's fixed fee using cents", () => {
    expect(estimateDelivery("sosedi", 30.97)).toEqual({
      min: 6,
      max: 6,
      totalMin: 36.97,
      totalMax: 36.97,
    });
  });
  it("keeps ordinary E-dostavka free without guessing a minimum order", () => {
    expect(estimateDelivery("evroopt", 10)?.totalMin).toBe(10);
  });
  it.each([
    ["a", 55, 8.99],
    ["b", 65, 10.99],
    ["c", 35, 8.99],
  ] as const)(
    "Green %s becomes free strictly above %s",
    (zone, threshold, fee) => {
      expect(estimateDelivery("green", threshold, zone)?.min).toBe(fee);
      expect(estimateDelivery("green", threshold + 0.01, zone)?.max).toBe(0);
    },
  );
  it("does not pick an address zone implicitly", () => {
    expect(estimateDelivery("green", 40)).toMatchObject({
      min: 0,
      max: 10.99,
      totalMin: 40,
      totalMax: 50.99,
    });
    expect(estimateDelivery("green", 70)).toMatchObject({ min: 0, max: 0 });
  });
  it("express remains paid above free standard thresholds", () => {
    expect(estimateDelivery("green", 100, "express")?.totalMin).toBe(110.99);
  });
  it.each(["gippo", "belmarket", "santa"] as const)(
    "never treats unknown %s fees as zero",
    (id) => {
      expect(estimateDelivery(id, 100)).toBeNull();
    },
  );
  it.each([0, -1, NaN, Infinity])(
    "does not quote an empty or invalid basket %s",
    (subtotal) => {
      expect(estimateDelivery("sosedi", subtotal)).toBeNull();
    },
  );
  it("accepts an explicit free quote and decimal comma", () => {
    expect(totalWithEnteredFees(30.97, "0")).toBe(30.97);
    expect(totalWithEnteredFees(30.97, "6,99")).toBe(37.96);
  });
  it.each(["", " ", "-1", "Infinity", "6.999", "1e2", "1000", "oops"])(
    "rejects an invalid quote %s",
    (input) => {
      expect(totalWithEnteredFees(30.97, input)).toBeNull();
    },
  );
});
