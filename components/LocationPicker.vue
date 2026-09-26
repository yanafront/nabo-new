<script setup lang="ts">
const emit = defineEmits<{ close: [] }>();
const { location } = useRetail();
const lat = ref(location.value.lat);
const lon = ref(location.value.lon);
const label = ref(location.value.label);
const error = ref("");
const locating = ref(false);
function save() {
  if (
    !Number.isFinite(lat.value) ||
    !Number.isFinite(lon.value) ||
    lat.value < 51 ||
    lat.value > 57 ||
    lon.value < 23 ||
    lon.value > 33
  ) {
    error.value = "Укажите точку в Беларуси";
    return;
  }
  location.value = {
    lat: lat.value,
    lon: lon.value,
    label: label.value.trim() || "Моя точка",
  };
  emit("close");
}
function locate() {
  if (!navigator.geolocation) {
    error.value = "Геолокация недоступна. Введите координаты вручную.";
    return;
  }
  locating.value = true;
  navigator.geolocation.getCurrentPosition(
    (p) => {
      lat.value = p.coords.latitude;
      lon.value = p.coords.longitude;
      label.value = "Моё местоположение";
      locating.value = false;
    },
    () => {
      error.value =
        "Не удалось определить местоположение. Введите координаты вручную.";
      locating.value = false;
    },
    { timeout: 10000 },
  );
}
</script>
<template>
  <AppModal title="Точка доставки" @close="emit('close')"
    ><p>
      Координаты нужны, чтобы выбрать доступные витрины магазинов. Возможность
      доставки уточняется при оформлении.
    </p>
    <button class="secondary full" :disabled="locating" @click="locate">
      {{ locating ? "Определяем…" : "Моё местоположение" }}
    </button>
    <form class="location-form" @submit.prevent="save">
      <label
        >Название точки<input
          v-model="label"
          maxlength="60"
          placeholder="Например, Дом"
      /></label>
      <div>
        <label
          >Широта<input
            v-model.number="lat"
            type="number"
            step="any"
            required
            min="51"
            max="57" /></label
        ><label
          >Долгота<input
            v-model.number="lon"
            type="number"
            step="any"
            required
            min="23"
            max="33"
        /></label>
      </div>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <button class="primary full">Сохранить точку</button>
    </form></AppModal
  >
</template>
