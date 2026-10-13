<script setup lang="ts">
import { jsonLd } from "~/shared/seo/core";
import { delivioSearchUrl, type DiningResult } from "~/shared/dining/delivio";
const props = defineProps<{
  title: string;
  initialResult?: DiningResult | null;
}>();
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
  {
    server: false,
    getCachedData: (_key, app, context) => {
      if (
        context.cause === "initial" &&
        app.isHydrating &&
        location.value.lat === 53.9 &&
        location.value.lon === 27.5667
      )
        return props.initialResult || undefined;
      return undefined;
    },
    default: () =>
      location.value.lat === 53.9 && location.value.lon === 27.5667
        ? props.initialResult || null
        : null,
  },
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
useHead(() => ({
  script: data.value?.offers.length
    ? [
        {
          key: "dining-offers-schema",
          type: "application/ld+json",
          innerHTML: jsonLd({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: `${props.title}: предложения готового блюда`,
            itemListElement: shown.value.map((offer, i) => ({
              "@type": "ListItem",
              position: i + 1,
              item: {
                "@type": "MenuItem",
                name: offer.name,
                image: offer.image,
                description: offer.portion,
                offers: {
                  "@type": "Offer",
                  price: offer.price,
                  priceCurrency: "BYN",
                  url: offer.url,
                  availability: `https://schema.org/${offer.available ? "InStock" : "OutOfStock"}`,
                  seller: { "@type": "Restaurant", name: offer.restaurant },
                },
              },
            })),
          }),
        },
      ]
    : [],
}));
</script>
<template>
  <section class="recipe-dining" aria-label="Приготовить или заказать">
    <div class="cook-summary"><slot name="cook-summary" /></div>
    <div class="dining-heading">
      <div>
        <h2 id="recipe-dining-title">
          <a href="#recipe-ready-offers">Заказать готовое</a>
        </h2>
      </div>
      <strong
        v-if="cheapest !== undefined && status !== 'pending' && !error"
        class="dining-from"
        >от {{ money(cheapest) }} BYN</strong
      >
      <p class="muted dining-subtitle">За порцию · без доставки</p>
    </div>
    <div class="cook-content"><slot name="cook-content" /></div>
    <div id="recipe-ready-offers" class="dining-content">
      <h2 class="dining-list-title">Заказать это блюдо</h2>
      <p class="muted dining-location">
        Предложения Delivio · {{ location.label }}
      </p>
      <div
        v-if="(status === 'pending' || status === 'idle') && !offers.length"
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
              <span class="dining-restaurant muted">{{
                offer.restaurant
              }}</span>
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
        >Цена за порцию заведения, без доставки. Размер и состав могут
        отличаться от рецепта. Наличие и итоговую стоимость уточните в Delivio.
        <span v-if="data?.limited"
          >Показана часть совпадений; полный список доступен в Delivio.</span
        ></small
      >
    </div>
  </section>
</template>
<style scoped>
.dining-loading {
  display: flex;
  gap: 10px;
  align-items: center;
  min-height: 70px;
  color: var(--muted);
  font-size: 14px;
}
.dining-offers li {
  min-width: 0;
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

.dining-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin: 16px 0 12px;
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
  .dining-name {
    font-size: 13px;
  }
}

.recipe-dining {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 28px 32px;
  margin: 0;
  padding: 0;
  border: 0;
}
.cook-content {
  grid-column: 1 / -1;
}
.cook-summary,
.cook-content,
.dining-content {
  min-width: 0;
}
.cook-summary,
.dining-heading {
  background: #f6f7f9;
  padding: 12px 16px;
  border-radius: 12px;
}
.cook-summary :deep(h2),
.dining-heading h2 {
  font-size: 14px;
  line-height: 1.3;
  font-weight: 600;
}
.dining-heading {
  display: block;
}
.dining-heading h2 a {
  color: inherit;
  text-decoration: none;
}
.dining-heading h2 a:hover {
  text-decoration: underline;
  text-underline-offset: 4px;
}
.dining-content {
  grid-column: 1 / -1;
  scroll-margin-top: 100px;
  border-top: 1px solid var(--line);
  padding-top: 28px;
  margin-top: 8px;
}
.dining-list-title {
  margin: 0 0 10px;
  display: block;
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 10px;
}
.dining-heading h2 {
  margin: 0;
  font-size: 14px;
}
.dining-from {
  display: block;
  margin: 6px 0 4px;
  padding: 0;
  font-size: 18px;
  line-height: 1.2;
  background: none;
  border-radius: 0;
}
.dining-subtitle {
  flex-basis: 100%;
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
}
.dining-location {
  margin: 0 0 12px;
  font-size: 12px;
}
.dining-offers {
  display: grid;
  list-style: none;
  padding: 0;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 0;
  gap: 18px 16px;
}
.dining-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  color: var(--ink);
  text-decoration: none;
  border: 0;
  border-radius: 0;
  overflow: visible;
}
.dining-card:hover {
  box-shadow: none;
}
.dining-card:hover .dining-name {
  color: var(--link, #2f6bff);
}
.dining-image {
  border-radius: 14px;
}
.dining-card-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  padding: 10px 0 0;
  gap: 3px;
}
.dining-price {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-top: auto;
  white-space: nowrap;
  font-size: 17px;
  padding-top: 6px;
}
.dining-caption {
  font-size: 11px;
}
@media (max-width: 700px) {
  .recipe-dining {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
    padding-top: 0;
  }
  .cook-summary :deep(h2),
  .dining-heading h2 {
    font-size: 14px;
  }
  .cook-summary,
  .dining-heading {
    padding: 12px;
    border-radius: 12px;
  }
  .dining-heading {
    display: block;
  }
  .dining-heading > div {
    min-height: 24px;
    display: flex;
    align-items: center;
  }
  .dining-from {
    font-size: 18px;
    margin: 6px 0 4px;
  }
  .dining-subtitle {
    font-size: 11px;
  }
  .dining-offers {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px 14px;
  }
  .dining-content {
    margin-top: 0;
    padding-top: 24px;
  }
  .dining-list-title {
    font-size: 22px;
  }
  .dining-price {
    font-size: 16px;
  }
}
</style>
