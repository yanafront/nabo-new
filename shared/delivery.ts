import type { StoreId } from "./yandex";

// Official published terms checked 2026-10-04. No address/slot availability API.
export const deliveryPolicies: Record<
  StoreId,
  { source: string; note: string }
> = {
  sosedi: {
    source: "https://sosedi-dostavka.by/legal/public-contract",
    note: "6 BYN за заказ в зоне доставки. Минимальной суммы нет. Необязательная платная упаковка не включена.",
  },
  evroopt: {
    source: "https://edostavka.by/information/help/delivery-and-payment",
    note: "Обычная доставка бесплатна. Минимальный заказ зависит от адреса и интервала: 0–99 BYN. Экспресс-обработка и упаковка не включены; доступность уточните у Е-доставки.",
  },
  green: {
    source: "https://green-dostavka.by/delivery/",
    note: "Обычная доставка: зона А — 8,99 BYN, бесплатно свыше 55 BYN; Б — 10,99 BYN, свыше 65 BYN; В — 8,99 BYN, свыше 35 BYN. Порог после скидок. Экспресс — 10,99 BYN. Зону проверьте на сайте Green.",
  },
  gippo: {
    source: "https://yandex.by/legal/termsofuse_eda/ru/",
    note: "Через Яндекс Еду. Доставка и сервисный сбор рассчитываются при оформлении для вашего адреса и заказа. Единого тарифа нет.",
  },
  belmarket: {
    source: "https://yandex.by/legal/termsofuse_eda/ru/",
    note: "Через Яндекс Еду. Доставка и сервисный сбор рассчитываются при оформлении для вашего адреса и заказа. Единого тарифа нет.",
  },
  santa: {
    source: "https://yandex.by/legal/termsofuse_eda/ru/",
    note: "Через Яндекс Еду. Доставка и сервисный сбор рассчитываются при оформлении для вашего адреса и заказа. Единого тарифа нет.",
  },
};
export type GreenZone = "unknown" | "a" | "b" | "c" | "express";
export interface DeliveryEstimate {
  min: number;
  max: number;
  totalMin: number;
  totalMax: number;
}
const cents = (value: number) => Math.round(value * 100);
export function estimateDelivery(
  storeId: StoreId,
  subtotal: number,
  zone: GreenZone = "unknown",
): DeliveryEstimate | null {
  if (!Number.isFinite(subtotal) || subtotal <= 0) return null;
  const amount = cents(subtotal);
  let fees: number[];
  if (storeId === "sosedi") fees = [600];
  else if (storeId === "evroopt") fees = [0];
  else if (storeId === "green") {
    const standard = {
      a: amount > 5500 ? 0 : 899,
      b: amount > 6500 ? 0 : 1099,
      c: amount > 3500 ? 0 : 899,
    };
    fees =
      zone === "unknown"
        ? Object.values(standard)
        : [zone === "express" ? 1099 : standard[zone]];
  } else return null;
  const min = Math.min(...fees),
    max = Math.max(...fees);
  return {
    min: min / 100,
    max: max / 100,
    totalMin: (amount + min) / 100,
    totalMax: (amount + max) / 100,
  };
}
export function totalWithEnteredFees(
  subtotal: number,
  input: string,
): number | null {
  if (!input.trim() || !/^\d+(?:[.,]\d{1,2})?$/.test(input.trim())) return null;
  const fee = Number(input.replace(",", "."));
  if (!Number.isFinite(subtotal) || subtotal <= 0 || fee > 999) return null;
  return (cents(subtotal) + cents(fee)) / 100;
}
