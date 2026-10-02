import { expect, it } from "vitest";
import { photonQueryVariants } from "../shared/address-query";
it("searches reviewed local street aliases while retaining the original and house number", () => {
  expect(photonQueryVariants("Минск, улица Притыцкого, 10")).toEqual([
    "Мінск, вуліца Прытыцкага, 10",
    "Минск, улица Притыцкого, 10",
  ]);
  expect(photonQueryVariants("Минск, пр-т Независимости, 24А")[0]).toBe(
    "Мінск, праспект Незалежнасці, 24А",
  );
});
it("supports the short Russian address from the delivery picker", () => {
  expect(photonQueryVariants("Авиационная 15")).toEqual([
    "Авіяцыйная 15",
    "Авиационная 15",
  ]);
});
it("does not transform parts of names or invent an address", () => {
  expect(photonQueryVariants("  Мiнск, Новая улица 999  ")).toEqual([
    "Мiнск, Новая вуліца 999",
    "Мiнск, Новая улица 999",
  ]);
  expect(photonQueryVariants("Прытыцкага 10")).toEqual(["Прытыцкага 10"]);
  expect(photonQueryVariants("Минская, 10")).toEqual(["Минская, 10"]);
});
