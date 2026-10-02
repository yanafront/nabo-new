<script setup lang="ts">
import {
  validDeliveryPoint,
  type AddressResult,
} from "~/shared/delivery-location";
import type { DeliveryLocation } from "~/shared/yandex";
const emit = defineEmits<{ close: [] }>();
const { location, invalidate } = useRetail();
const address = ref("");
const draft = ref<DeliveryLocation | null>({ ...location.value });
const results = ref<AddressResult[]>([]);
const addressError = ref("");
const geoError = ref("");
const locating = ref(false);
const searching = ref(false);
const accuracy = ref<number>();
const precise = ref(true);
const provider = ref("photon");
let operation = 0;
let controller: AbortController | undefined;
const busy = computed(() => locating.value || searching.value);
function cancelPending() {
  operation++;
  controller?.abort();
  locating.value = false;
  searching.value = false;
}
watch(
  address,
  () => {
    cancelPending();
    draft.value = null;
    results.value = [];
    accuracy.value = undefined;
    addressError.value = "";
    geoError.value = "";
  },
  { flush: "sync" },
);
onBeforeUnmount(cancelPending);
async function searchAddress() {
  cancelPending();
  addressError.value = "";
  geoError.value = "";
  draft.value = null;
  results.value = [];
  if (address.value.trim().length < 5) {
    addressError.value = "Введите город, улицу и номер дома.";
    return;
  }
  const current = operation;
  controller = new AbortController();
  searching.value = true;
  try {
    const response = await $fetch<{
      addresses: AddressResult[];
      provider: string;
    }>("/api/location/search", {
      query: { q: address.value.trim() },
      signal: controller.signal,
      timeout: 20000,
      retry: 0,
    });
    if (current !== operation) return;
    results.value = response.addresses;
    provider.value = response.provider;
    if (!results.value.length)
      addressError.value =
        "Поиск не нашёл этот адрес. Попробуйте белорусское название улицы или поставьте метку на нужный дом на карте ниже.";
  } catch (failure: any) {
    if (current === operation && failure.statusCode === 429)
      addressError.value = "Подождите пару секунд и повторите поиск.";
    else if (current === operation)
      addressError.value =
        "Не удалось найти адрес. Повторите поиск или используйте геолокацию.";
  } finally {
    if (current === operation) searching.value = false;
  }
}
function choose(point: AddressResult) {
  draft.value = { lat: point.lat, lon: point.lon, label: point.label };
  precise.value = point.precise;
  accuracy.value = undefined;
  addressError.value = "";
  geoError.value = "";
}
function selectOnMap(point: { lat: number; lon: number }) {
  cancelPending();
  draft.value = { ...point, label: "Точка на карте" };
  precise.value = true;
  accuracy.value = undefined;
  results.value = [];
  addressError.value = "";
  geoError.value = "";
}
function locate() {
  cancelPending();
  geoError.value = "";
  addressError.value = "";
  results.value = [];
  if (!navigator.geolocation) {
    geoError.value =
      "Геолокация недоступна в этом браузере. Найдите адрес вручную.";
    return;
  }
  locating.value = true;
  const current = operation;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      if (current !== operation) return;
      locating.value = false;
      const { latitude: lat, longitude: lon } = position.coords;
      if (!validDeliveryPoint(lat, lon)) {
        geoError.value =
          "Сейчас поиск поддерживает точки в Беларуси. Введите адрес доставки в Беларуси.";
        return;
      }
      draft.value = { lat, lon, label: "Моё местоположение" };
      results.value = [];
      precise.value = true;
      accuracy.value = Math.round(position.coords.accuracy);
    },
    (failure) => {
      if (current !== operation) return;
      locating.value = false;
      geoError.value =
        failure.code === 1
          ? "Доступ к геолокации запрещён. Разрешите его в браузере или введите адрес."
          : failure.code === 3
            ? "Браузер не определил местоположение. Выберите нужный дом на карте или найдите адрес."
            : "Не удалось определить местоположение. Введите адрес доставки.";
    },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
  );
}
function save() {
  if (
    busy.value ||
    !draft.value ||
    !validDeliveryPoint(draft.value.lat, draft.value.lon)
  )
    return;
  location.value = { ...draft.value };
  invalidate();
  emit("close");
}
</script>
<template>
  <AppModal
    title="Точка доставки"
    class="location-modal"
    @close="emit('close')"
  >
    <p class="muted">
      Укажите, куда нужны продукты. По этой точке мы ищем доступные товары и
      сравниваем магазины.
    </p>
    <button
      type="button"
      class="secondary full"
      :disabled="locating"
      @click="locate"
    >
      <AppIcon name="MapPin" :size="18" />{{
        locating
          ? "Определяем местоположение…"
          : "Определить моё местоположение"
      }}
    </button>
    <p v-if="geoError" role="alert" class="error">{{ geoError }}</p>
    <form class="address-search" @submit.prevent="searchAddress">
      <label for="delivery-address">Или найдите адрес доставки</label>
      <div class="address-search-row">
        <input
          id="delivery-address"
          v-model="address"
          autocomplete="street-address"
          placeholder="Минск, улица Притыцкого, 10"
          maxlength="160"
        />
        <button class="primary" :disabled="busy || address.trim().length < 5">
          {{ searching ? "Поиск…" : "Найти" }}
        </button>
      </div>
    </form>
    <p v-if="addressError" role="alert" class="error">{{ addressError }}</p>
    <div
      v-if="results.length"
      class="address-results"
      aria-label="Найденные адреса"
    >
      <p class="muted">Выберите подходящий адрес</p>
      <button
        v-for="point in results"
        :key="`${point.lat}:${point.lon}:${point.label}`"
        type="button"
        :aria-pressed="
          draft?.label === point.label &&
          draft?.lat === point.lat &&
          draft?.lon === point.lon
        "
        @click="choose(point)"
      >
        <AppIcon name="MapPin" :size="18" /><span
          >{{ point.label
          }}<small v-if="!point.precise"
            >Точка улицы или района — номер дома не найден</small
          ></span
        >
      </button>
    </div>
    <ClientOnly>
      <DeliveryMap :point="draft" :center="location" @select="selectOnMap" />
      <template #fallback
        ><div class="delivery-map muted">Загружаем карту…</div></template
      >
    </ClientOnly>
    <div v-if="draft" class="delivery-point-summary" role="status">
      <strong>{{ draft.label }}</strong>
      <small
        >{{ draft.lat.toFixed(6) }}, {{ draft.lon.toFixed(6)
        }}<template v-if="accuracy !== undefined">
          · точность около {{ accuracy }} м</template
        ></small
      >
      <a
        class="text-button"
        :href="`https://yandex.by/maps/?pt=${draft.lon},${draft.lat}&z=17&l=map`"
        target="_blank"
        rel="noopener noreferrer"
        >Проверить точку на карте</a
      >
      <p v-if="!precise" class="muted">
        Это приблизительная точка. Для более точного поиска укажите номер дома
        или определите местоположение.
      </p>
      <p v-if="accuracy !== undefined && accuracy > 200" class="muted">
        Браузер определил точку приблизительно. Поиск по адресу может быть
        точнее.
      </p>
    </div>
    <button
      type="button"
      class="primary full"
      :disabled="busy || !draft"
      @click="save"
    >
      Использовать эту точку
    </button>
    <p class="location-caption muted">
      <template v-if="provider === 'photon'"
        >Адреса:
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          >© OpenStreetMap</a
        >
        · Photon.</template
      >
      <template v-else>Адреса: Яндекс Карты.</template> Доставку по адресу
      уточните у магазина.
    </p>
  </AppModal>
</template>
