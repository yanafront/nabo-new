<script setup lang="ts">
import {
  deliveryPolicies,
  estimateDelivery,
  totalWithEnteredFees,
  type GreenZone,
} from "~/shared/delivery";
import { storeUrl, type StoreId } from "~/shared/yandex";
const props = withDefaults(
  defineProps<{
    storeId: StoreId;
    subtotal: number;
    complete?: boolean;
    context?: string;
    conditionsOnly?: boolean;
    summaryOnly?: boolean;
  }>(),
  { complete: true, context: "offer" },
);
const { location, comparisons } = useRetail();
const choices = useState<Record<string, { zone: GreenZone; fee: string }>>(
  "delivery-cost-choices",
  () => ({}),
);
// An entered quote applies only to this amount, address and basket context.
const key = computed(() =>
  JSON.stringify([
    props.context,
    props.storeId,
    props.subtotal,
    comparisons.value
      .find((offer) => offer.storeId === props.storeId)
      ?.lines.map((line) => [line.itemId, line.selected?.id, line.quantity]),
    location.value.lat,
    location.value.lon,
  ]),
);
const choice = computed(
  () => choices.value[key.value] || { zone: "unknown" as GreenZone, fee: "" },
);
const zone = computed({
  get: () => choice.value.zone,
  set: (value: GreenZone) => {
    choices.value[key.value] = { ...choice.value, zone: value };
  },
});
const fee = computed({
  get: () => choice.value.fee,
  set: (value: string) => {
    choices.value[key.value] = { ...choice.value, fee: value };
  },
});
const policy = computed(() => deliveryPolicies[props.storeId]);
const estimate = computed(() =>
  estimateDelivery(props.storeId, props.subtotal, zone.value),
);
const enteredTotal = computed(() =>
  totalWithEnteredFees(props.subtotal, fee.value),
);
const range = (min: number, max: number) =>
  min === max ? `${money(min)} BYN` : `${money(min)}–${money(max)} BYN`;
</script>
<template>
  <div v-if="subtotal > 0" class="delivery-cost">
    <template v-if="!conditionsOnly">
      <div class="delivery-cost-row">
        <span>{{
          enteredTotal !== null ? "Доставка и сборы" : "Доставка"
        }}</span
        ><span>{{
          enteredTotal !== null
            ? `${money(Number(fee.replace(",", ".")))} BYN`
            : estimate
              ? estimate.max === 0
                ? "Бесплатно"
                : range(estimate.min, estimate.max)
              : "Уточняется при оформлении"
        }}</span>
      </div>
      <div class="delivery-cost-row delivery-cost-total">
        <span>{{ complete ? "С доставкой" : "Найденное с доставкой" }}</span
        ><strong>{{
          enteredTotal !== null
            ? `${money(enteredTotal)} BYN`
            : estimate
              ? range(estimate.totalMin, estimate.totalMax)
              : "Пока неизвестно"
        }}</strong>
      </div>
      <small v-if="enteredTotal !== null"
        >С учётом введённой вами суммы доставки и сборов.</small
      >
      <small v-else-if="estimate"
        >Оценка{{
          storeId === "green" && zone === "unknown" ? " по зонам" : ""
        }}
        · доступность по адресу подтвердит магазин.</small
      >
    </template>
    <details v-if="!summaryOnly">
      <summary>
        {{ estimate ? "Условия доставки" : "Уточнить доставку и сборы" }}
      </summary>
      <p>{{ policy.note }}</p>
      <label v-if="storeId === 'green'" class="delivery-field"
        >Зона доставки Green
        <select v-model="zone">
          <option value="unknown">Зона пока неизвестна</option>
          <option value="a">Зона А</option>
          <option value="b">Зона Б</option>
          <option value="c">Зона В</option>
          <option value="express">Экспресс</option>
        </select>
      </label>
      <a :href="policy.source" target="_blank" rel="noopener noreferrer"
        >Условия на сайте · проверено 04.10.2026</a
      >
      <template v-if="!estimate">
        <a :href="storeUrl(storeId)" target="_blank" rel="noopener noreferrer"
          >Проверить стоимость у магазина ↗</a
        >
        <label class="delivery-field"
          >Доставка и все сборы, BYN
          <input
            v-model="fee"
            inputmode="decimal"
            placeholder="Введите сумму из магазина"
            maxlength="6"
          />
        </label>
        <small v-if="fee && enteredTotal === null" class="error"
          >Введите сумму от 0 до 999 BYN, до двух знаков после запятой.</small
        >
      </template>
    </details>
  </div>
</template>
<style scoped>
.delivery-cost {
  min-width: 0;
  font-size: 13px;
  border-top: 1px solid var(--line);
  padding-top: 12px;
}
.delivery-cost-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 6px;
}
.delivery-cost-row > * {
  min-width: 0;
  overflow-wrap: anywhere;
}
.delivery-cost-row > :last-child {
  text-align: right;
}
.delivery-cost-total strong {
  font-size: 17px;
}
.delivery-cost > small {
  display: block;
  color: var(--muted);
  font-size: 11px;
}
summary {
  cursor: pointer;
  color: var(--accent-blue);
  margin-top: 8px;
  font-size: 12px;
}
details p {
  font-size: 12px;
  line-height: 1.5;
  margin: 10px 0;
}
details a {
  display: block;
  color: var(--accent-blue);
  font-size: 12px;
  margin-top: 8px;
}
.delivery-field {
  display: grid;
  gap: 5px;
  font-size: 12px;
  margin-top: 10px;
}
.delivery-field input,
.delivery-field select {
  width: 100%;
  min-width: 0;
  min-height: 38px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface, #f6f7f9);
  font: inherit;
}
@media (max-width: 600px) {
  .delivery-cost-total strong {
    font-size: 15px;
  }
}
</style>
