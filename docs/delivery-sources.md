# Delivery conditions checked 2026-10-04

The comparison API returns product subtotals only. Frontend estimates are published tariffs, not delivery availability or checkout quotes. Product ranking and savings remain product-only.

| Catalogue provider | Source | Included estimate |
| --- | --- | --- |
| Sosedi delivery | https://sosedi-dostavka.by/legal/public-contract | Contract dated 22.09.2026, §4.5: 6 BYN per order. §4.1: no minimum. Delivery zone must be confirmed. Optional paid packaging excluded (§5.3). |
| E-dostavka (Evroopt) | https://edostavka.by/information/help/delivery-and-payment | Ordinary delivery at seller expense. Minimum order 0–99 BYN varies by address and slot. Express processing and packaging excluded. Public HTML fetched successfully; no obsolete 2023 tariffs used. |
| Green delivery | https://green-dostavka.by/delivery/ | Standard zone A: 8.99/free strictly over 55; B: 10.99/free over 65; C: 8.99/free over 35. Threshold after discounts. Unknown zone gives a range. Express 10.99. No automatic zone assignment from coordinates. |
| Gippo, Belmarket, Santa via Yandex Eats | https://yandex.by/legal/termsofuse_eda/ru/ | No universal verified fee. Delivery and service charge depend on checkout. Show unknown, allow user to enter combined delivery + fees from actual shop. |

Links to checkout use the actual Nabo provider from `shared/yandex.ts`, not an unrelated delivery service operated by the same brand.

Entered fees are session-only and keyed by store, subtotal, address coordinates and offer/split context. They do not claim to be a provider quote or trigger external requests. Changing those values resets the entered quote. Partial baskets clearly label their estimate as found products only. Published tariffs require periodic manual review; change `shared/delivery.ts` and this audit together.
