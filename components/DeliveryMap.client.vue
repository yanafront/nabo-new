<script setup lang="ts">
import type { DeliveryLocation } from "~/shared/yandex";
import { validDeliveryPoint } from "~/shared/delivery-location";
import type { Map as LeafletMap, Marker } from "leaflet";
const props = defineProps<{
  point: DeliveryLocation | null;
  center: DeliveryLocation;
}>();
const emit = defineEmits<{ select: [point: { lat: number; lon: number }] }>();
const container = ref<HTMLElement>();
const pending = ref(true);
const failure = ref("");
const source = ref("");
let disposed = false;
let leaflet: LeafletMap | undefined;
let marker: Marker | undefined;
let L: typeof import("leaflet") | undefined;
let ymap: any;
let placemark: any;
function select(lat: number, lon: number) {
  if (!validDeliveryPoint(lat, lon)) {
    failure.value = "Выберите точку в Беларуси.";
    return;
  }
  failure.value = "";
  emit("select", { lat, lon });
}
async function loadYandex(key: string) {
  const windowMap = window as any;
  if (!windowMap.__naboYandexReady) {
    windowMap.__naboYandexReady = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const timer = window.setTimeout(() => {
        script.remove();
        reject(new Error("Map timeout"));
      }, 10000);
      script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(key)}&lang=ru_RU`;
      script.async = true;
      script.onload = () => {
        if (!windowMap.ymaps) {
          clearTimeout(timer);
          reject(new Error("Map unavailable"));
          return;
        }
        windowMap.ymaps.ready(() => {
          clearTimeout(timer);
          resolve(windowMap.ymaps);
        });
      };
      script.onerror = () => {
        clearTimeout(timer);
        script.remove();
        reject(new Error("Map unavailable"));
      };
      document.head.appendChild(script);
    }).catch((error: unknown) => {
      delete windowMap.__naboYandexReady;
      throw error;
    });
  }
  return windowMap.__naboYandexReady;
}
function syncPoint() {
  const point = props.point;
  if (leaflet && L) {
    if (!point) {
      marker?.remove();
      marker = undefined;
      return;
    }
    if (!marker) {
      marker = L.marker([point.lat, point.lon], {
        draggable: true,
        keyboard: true,
        title: "Точка доставки — перетащите метку",
        icon: L.divIcon({
          className: "delivery-pin",
          html: '<span aria-hidden="true"></span>',
          iconSize: [30, 38],
          iconAnchor: [15, 38],
        }),
      }).addTo(leaflet);
      marker.on("dragend", () => {
        const p = marker!.getLatLng();
        select(p.lat, p.lng);
        syncPoint();
      });
    } else marker.setLatLng([point.lat, point.lon]);
    leaflet.panTo([point.lat, point.lon]);
  }
  if (ymap) {
    if (!point) {
      if (placemark) ymap.geoObjects.remove(placemark);
      placemark = undefined;
      return;
    }
    if (!placemark) {
      placemark = new (window as any).ymaps.Placemark(
        [point.lat, point.lon],
        {},
        { draggable: true, preset: "islands#blueDotIcon" },
      );
      placemark.events.add("dragend", () => {
        const p = placemark.geometry.getCoordinates();
        select(p[0], p[1]);
        syncPoint();
      });
      ymap.geoObjects.add(placemark);
    } else placemark.geometry.setCoordinates([point.lat, point.lon]);
    ymap.setCenter([point.lat, point.lon]);
  }
}
watch(() => props.point, syncPoint, { deep: true });
onMounted(async () => {
  const key = useRuntimeConfig().public.yandexMapsApiKey;
  const p = props.point || props.center;
  try {
    if (key) {
      try {
        const ymaps = await loadYandex(key);
        if (disposed || !container.value) return;
        ymap = new ymaps.Map(container.value, {
          center: [p.lat, p.lon],
          zoom: 16,
          controls: ["zoomControl"],
        });
        ymap.behaviors.disable("scrollZoom");
        ymap.events.add("click", (event: any) => {
          const coords = event.get("coords");
          select(coords[0], coords[1]);
        });
        source.value = "Яндекс Карты";
      } catch {
        failure.value =
          "Карта Яндекса недоступна. Можно выбрать точку на резервной карте.";
      }
    }
    if (!ymap) {
      L = await import("leaflet");
      if (disposed || !container.value) return;
      leaflet = L.map(container.value, { scrollWheelZoom: false }).setView(
        [p.lat, p.lon],
        16,
      );
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(leaflet);
      leaflet.on("click", (event) =>
        select(event.latlng.lat, event.latlng.lng),
      );
      source.value = "OpenStreetMap";
    }
    syncPoint();
  } catch {
    failure.value =
      "Карта не загрузилась. Попробуйте поиск адреса или геолокацию.";
  } finally {
    if (!disposed) pending.value = false;
  }
});
onBeforeUnmount(() => {
  disposed = true;
  leaflet?.remove();
  ymap?.destroy();
});
</script>
<template>
  <div class="delivery-map-block">
    <p class="delivery-map-instruction">
      Нажмите на нужный дом или перетащите метку
    </p>
    <div
      ref="container"
      class="delivery-map"
      aria-label="Карта для выбора точки доставки"
    />
    <p v-if="pending" role="status" class="muted">Загружаем карту…</p>
    <p v-if="failure" role="status" class="error">{{ failure }}</p>
    <small v-if="source" class="muted">{{ source }}</small>
  </div>
</template>
