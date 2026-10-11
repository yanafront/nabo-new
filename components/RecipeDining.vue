<script setup lang="ts">
import { delivioSearchUrl, type DiningResult } from "~/shared/dining/delivio";
const props = defineProps<{ title: string }>();
const { location } = useRetail();
const query = computed(() => ({
  q: props.title.trim(),
  lat: location.value.lat,
  lon: location.value.lon,
}));
const key = computed(() => `recipe-dining:${JSON.stringify(query.value)}`);
const { data, status, error, refresh } = await useLazyAsyncData(
  key,
  () =>
    $fetch<DiningResult>("/api/dining/search", {
      query: query.value,
      retry: 0,
      timeout: 16000,
    }),
  { server: false },
);
const offers = computed(() => data.value?.offers || []);
const available = computed(() =>
  offers.value.filter((offer) => offer.available),
);
const cheapest = computed(() =>
  available.value.length
    ? Math.min(...available.value.map((offer) => offer.price))
    : undefined,
);
const searchUrl = computed(() => delivioSearchUrl(props.title));
const expanded = ref(false);
const failedImages = ref(new Set<string>());
function imageFailed(id: string) {
  failedImages.value = new Set([...failedImages.value, id]);
}
watch(key, () => {
  expanded.value = false;
  failedImages.value = new Set();
});
const shown = computed(() => offers.value.slice(0, expanded.value ? 12 : 4));
</script>
<template>
  <section class="recipe-dining panel" aria-labelledby="recipe-dining-title">
    <div class="dining-heading">
      <div>
        <h2 id="recipe-dining-title">Заказать готовое</h2>
        <p class="muted">Предложения Delivio · {{ location.label }}</p>
      </div>
      <strong
        v-if="cheapest !== undefined && status !== 'pending' && !error"
        class="dining-from"
        >от {{ money(cheapest) }} BYN</strong
      >
    </div>
    <div
      v-if="status === 'pending' || status === 'idle'"
      class="dining-loading"
      role="status"
    >
      <span class="spinner" /> Ищем блюдо в заведениях…
    </div>
    <div v-else-if="error" class="dining-empty">
      <p>Не удалось загрузить предложения. Можно посмотреть их в Delivio.</p>
      <button class="text-button" @click="refresh()">Повторить</button>
    </div>
    <p v-else-if="!offers.length" class="muted">
      По названию «{{ title }}» предложений пока нет.
    </p>
    <ul v-else class="dining-offers">
      <li v-for="offer in shown" :key="offer.id">
        <a
          class="dining-card"
          :class="{ 'is-unavailable': !offer.available }"
          :href="offer.url"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="`Открыть ${offer.restaurant} в Delivio`"
          :title="`${offer.name} · ${offer.restaurant}`"
        >
          <div class="dining-image">
            <img
              v-if="offer.image && !failedImages.has(offer.id)"
              :src="offer.image"
              :alt="offer.name"
              loading="lazy"
              decoding="async"
              referrerpolicy="no-referrer"
              @error="imageFailed(offer.id)"
            />
            <div
              v-else
              class="dining-image-placeholder"
              aria-label="Фото блюда отсутствует"
            >
              <AppIcon name="Utensils" :size="28" />
            </div>
            <span v-if="!offer.available" class="dining-unavailable"
              >Сейчас недоступно</span
            >
          </div>
          <div class="dining-card-body">
            <strong class="dining-name">{{ offer.name }}</strong>
            <span class="dining-restaurant muted">{{ offer.restaurant }}</span>
            <span class="dining-portion muted">{{
              offer.portion || "Порция заведения"
            }}</span>
            <div class="dining-price">
              <strong>{{ money(offer.price) }} BYN</strong
              ><AppIcon name="ExternalLink" :size="15" />
            </div>
          </div>
        </a>
      </li>
    </ul>
    <div class="dining-footer">
      <button
        v-if="offers.length > 4 && !expanded"
        class="text-button"
        @click="expanded = true"
      >
        Ещё предложения</button
      ><a
        :href="data?.searchUrl || searchUrl"
        target="_blank"
        rel="noopener noreferrer"
        >Все предложения в Delivio <AppIcon name="ExternalLink" :size="14"
      /></a>
    </div>
    <small class="dining-caption muted"
      >Цена за порцию заведения, без доставки. Размер и состав могут отличаться
      от рецепта. Наличие и итоговую стоимость уточните в Delivio.
      <span v-if="data?.limited"
        >Показана часть совпадений; полный список доступен в Delivio.</span
      ></small
    >
  </section>
</template>
<style scoped>
.recipe-dining {
  margin: 24px 0;
  padding: 22px 24px;
  min-width: 0;
}
.dining-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.dining-heading h2 {
  font-size: 21px;
  margin: 0 0 6px;
}
.dining-heading p {
  font-size: 13px;
  margin: 0;
}
.dining-from {
  font-size: 20px;
  white-space: nowrap;
  padding: 8px 12px;
  border-radius: 12px;
  background: var(--brand-soft);
}
.dining-loading {
  display: flex;
  gap: 10px;
  align-items: center;
  min-height: 70px;
  color: var(--muted);
  font-size: 14px;
}
.dining-offers {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  list-style: none;
  padding: 0;
  margin: 18px 0 0;
}
.dining-offers li {
  min-width: 0;
}
.dining-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--surface);
  color: var(--ink);
  text-decoration: none;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.dining-card:hover {
  border-color: var(--brand-hover);
  box-shadow: 0 4px 16px #0f0f100c;
}
.dining-card:focus-visible {
  outline: 2px solid var(--brand-hover);
  outline-offset: 3px;
}
.dining-image {
  position: relative;
  aspect-ratio: 4/3;
  overflow: hidden;
  flex-shrink: 0;
  background: #f6f7f8;
}
.dining-image img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.dining-image-placeholder {
  display: grid;
  place-items: center;
  height: 100%;
  color: var(--muted);
}
.dining-unavailable {
  position: absolute;
  bottom: 8px;
  left: 8px;
  right: 8px;
  width: fit-content;
  padding: 4px 7px;
  border-radius: 7px;
  background: #fffffff0;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.3;
}
.is-unavailable .dining-image img {
  opacity: 0.65;
}
.dining-card-body {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
  min-width: 0;
  padding: 12px;
}
.dining-name {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
  font-size: 14px;
  line-height: 1.4;
  min-height: 2.8em;
}
.dining-restaurant {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 1.4;
}
.dining-portion {
  font-size: 11px;
  line-height: 1.4;
}
.dining-price {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-top: auto;
  padding-top: 8px;
  font-size: 15px;
  white-space: nowrap;
}
.dining-price svg {
  color: var(--link, #2f6bff);
  flex-shrink: 0;
}
.dining-footer a {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  color: var(--link, #2f6bff);
}
@media (max-width: 1000px) {
  .dining-offers {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.dining-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin: 15px 0 12px;
}
.dining-footer .text-button {
  font-size: 13px;
  padding: 0;
  min-height: 32px;
}
.dining-caption {
  display: block;
  font-size: 11px;
  line-height: 1.5;
}
.dining-empty {
  font-size: 14px;
}
@media (max-width: 600px) {
  .recipe-dining {
    padding: 16px;
    margin: 18px 0;
  }
  .dining-heading {
    flex-wrap: wrap;
    gap: 10px;
  }
  .dining-heading h2 {
    font-size: 18px;
  }
  .dining-from {
    font-size: 16px;
    padding: 6px 10px;
  }
  .dining-offers {
    gap: 10px;
  }
  .dining-card-body {
    padding: 10px;
  }
  .dining-name {
    font-size: 13px;
  }
  .dining-price {
    font-size: 13px;
  }
}
</style>
