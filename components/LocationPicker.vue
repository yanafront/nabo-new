<script setup lang="ts">
import {
  validDeliveryPoint,
  type AddressResult,
} from "~/shared/delivery-location";
import type { DeliveryLocation } from "~/shared/yandex";
import { startGeolocation } from "~/shared/geolocation";
const emit = defineEmits<{ close: [] }>();
const { location, invalidate } = useRetail();
const { notice } = useBasket();
const selection = ref<"saved" | "gps" | "address" | "map">("saved");
const address = ref("");
const addressInput = ref<HTMLInputElement>();
const draft = ref<DeliveryLocation | null>({ ...location.value });
const results = ref<AddressResult[]>([]);
const addressError = ref("");
const geoError = ref("");
const locating = ref(false);
const locatingPrecisely = ref(false);
const searching = ref(false);
const accuracy = ref<number>();
const precise = ref(true);
const provider = ref("photon");
let operation = 0;
let controller: AbortController | undefined;
let cancelGeolocation: (() => void) | undefined;
const busy = computed(() => locating.value || searching.value);
function cancelPending() {
  operation++;
  controller?.abort();
  cancelGeolocation?.();
  cancelGeolocation = undefined;
  locating.value = false;
  locatingPrecisely.value = false;
  searching.value = false;
}
watch(
  address,
  () => {
    cancelPending();
    draft.value = null;
    selection.value = "saved";
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
  addressInput.value?.blur();
  const current = operation;
  controller = new AbortController();
  searching.value = true;
  try {
    const response = await $fetch<{
      addresses: AddressResult[];
      provider: string;
    }>("/api/location/search", {
      query: {
        q: address.value.trim(),
        lat: location.value.lat,
        lon: location.value.lon,
      },
      signal: controller.signal,
      timeout: 20000,
      retry: 0,
    });
    if (current !== operation) return;
    results.value = response.addresses;
    provider.value = response.provider;
    if (!results.value.length)
      addressError.value =
        "Адрес не найден. Уточните город или выберите дом на карте.";
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
  selection.value = "address";
  results.value = [];
  draft.value = { lat: point.lat, lon: point.lon, label: point.label };
  precise.value = point.precise;
  accuracy.value = undefined;
  addressError.value = "";
  geoError.value = "";
}
function selectOnMap(point: { lat: number; lon: number }) {
  addressInput.value?.blur();
  cancelPending();
  draft.value = { ...point, label: "Точка на карте" };
  selection.value = "map";
  precise.value = true;
  accuracy.value = undefined;
  results.value = [];
  addressError.value = "";
  geoError.value = "";
}
function locate() {
  addressInput.value?.blur();
  cancelPending();
  geoError.value = "";
  addressError.value = "";
  results.value = [];
  if (!window.isSecureContext) {
    geoError.value =
      "Геолокация недоступна. Найдите адрес или выберите точку на карте.";
    return;
  }
  const policy =
    (
      document as Document & {
        permissionsPolicy?: { allowsFeature(name: string): boolean };
        featurePolicy?: { allowsFeature(name: string): boolean };
      }
    ).permissionsPolicy || (document as any).featurePolicy;
  if (policy && !policy.allowsFeature("geolocation")) {
    geoError.value =
      "Браузер блокирует геолокацию. Выберите адрес или точку на карте.";
    return;
  }
  if (!navigator.geolocation) {
    geoError.value =
      "Геолокация недоступна в этом браузере. Найдите адрес вручную.";
    return;
  }
  locating.value = true;
  const current = operation;
  cancelGeolocation = startGeolocation(navigator.geolocation, {
    retry: () => {
      if (current === operation) locatingPrecisely.value = true;
    },
    success: (position) => {
      if (current !== operation) return;
      locating.value = false;
      const { latitude: lat, longitude: lon } = position.coords;
      if (!validDeliveryPoint(lat, lon)) {
        geoError.value =
          "Сейчас поиск поддерживает точки в Беларуси. Введите адрес доставки в Беларуси.";
        return;
      }
      draft.value = { lat, lon, label: "Моё местоположение" };
      selection.value = "gps";
      results.value = [];
      precise.value = true;
      accuracy.value = Math.round(position.coords.accuracy);
    },
    error: (failure) => {
      if (current !== operation) return;
      locating.value = false;
      geoError.value =
        failure.code === 1
          ? "Разрешите геолокацию в настройках браузера или выберите точку на карте."
          : failure.code === 3
            ? "Не удалось получить координаты. Найдите адрес или выберите точку на карте."
            : "Местоположение недоступно. Найдите адрес или выберите точку на карте.";
    },
  });
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
  notice.value = "Точка доставки сохранена";
  emit("close");
}
</script>
<template>
  <AppModal
    title="Точка доставки"
    class="location-modal"
    @close="emit('close')"
  >
    <div class="location-picker-body">
      <form class="address-search" @submit.prevent="searchAddress">
        <label class="sr-only" for="delivery-address">Адрес доставки</label>
        <div class="address-search-row">
          <input
            ref="addressInput"
            id="delivery-address"
            v-model="address"
            autocomplete="street-address"
            placeholder="Город, улица, дом"
            maxlength="160"
          />
          <button class="primary" :disabled="busy || address.trim().length < 5">
            {{ searching ? "Поиск…" : "Найти" }}
          </button>
        </div>
      </form>
      <div class="location-geolocation-row">
        <button
          type="button"
          class="secondary full"
          :disabled="locating"
          @click="locate"
        >
          <AppIcon name="MapPin" :size="18" />{{
            locating
              ? locatingPrecisely
                ? "Уточняем точку…"
                : "Определяем точку…"
              : "Моё местоположение"
          }}
        </button>
        <button
          v-if="locating"
          type="button"
          class="text-button"
          @click="cancelPending"
        >
          Отмена
        </button>
      </div>
      <p
        v-if="addressError || geoError"
        role="alert"
        class="error location-error"
      >
        {{ addressError || geoError }}
      </p>
      <div class="location-map-area">
        <div
          v-if="results.length"
          class="address-results"
          aria-label="Найденные адреса"
        >
          <p class="muted">Выберите адрес</p>
          <button
            v-for="point in results"
            :key="`${point.lat}:${point.lon}:${point.label}`"
            type="button"
            @click="choose(point)"
          >
            <AppIcon name="MapPin" :size="18" /><span
              >{{ point.label
              }}<small v-if="!point.precise"
                >Дом не найден — уточните метку</small
              ></span
            >
          </button>
        </div>
        <div v-show="!results.length" class="location-map-view">
          <ClientOnly>
            <DeliveryMap
              compact
              :point="draft"
              :center="location"
              @select="selectOnMap"
            />
            <template #fallback
              ><div class="delivery-map muted">Загружаем карту…</div></template
            >
          </ClientOnly>
        </div>
      </div>
    </div>
    <template #footer>
      <div class="location-picker-footer">
        <div class="delivery-point-summary" role="status" aria-live="polite">
          <AppIcon
            :name="selection === 'saved' ? 'MapPin' : 'CircleCheck'"
            :size="22"
          />
          <div>
            <strong>{{
              draft
                ? selection === "gps"
                  ? "Местоположение определено"
                  : selection === "saved"
                    ? "Текущая точка"
                    : "Точка выбрана"
                : "Выберите точку доставки"
            }}</strong>
            <small>{{
              draft?.label || "Найдите адрес или нажмите на карту"
            }}</small>
            <small v-if="draft" class="delivery-coordinates"
              >{{ draft.lat.toFixed(6) }}, {{ draft.lon.toFixed(6) }}</small
            >
            <small
              v-if="
                draft &&
                (!precise || (accuracy !== undefined && accuracy > 200))
              "
              >Приблизительно — уточните метку на карте</small
            >
          </div>
        </div>
        <button
          type="button"
          class="primary full"
          :disabled="busy || !draft"
          @click="save"
        >
          Сохранить точку доставки
        </button>
        <small class="location-caption muted">
          <a
            v-if="provider === 'photon'"
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            >© OpenStreetMap</a
          >
          <span v-else>© Яндекс Карты</span>
        </small>
      </div>
    </template>
  </AppModal>
</template>
