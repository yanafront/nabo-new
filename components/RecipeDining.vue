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
watch(key, () => (expanded.value = false));
const shown = computed(() => offers.value.slice(0, expanded.value ? 12 : 3));
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
        <div class="dining-description">
          <strong>{{ offer.name }}</strong
          ><span class="muted"
            >{{ offer.restaurant
            }}<template v-if="offer.portion">
              · {{ offer.portion }}</template
            ></span
          ><small v-if="!offer.available" class="muted"
            >Сейчас недоступно для заказа</small
          >
        </div>
        <div class="dining-price">
          <strong>{{ money(offer.price) }} BYN</strong
          ><a
            :href="offer.url"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="`Открыть ${offer.restaurant} в Delivio`"
            >В Delivio <AppIcon name="ExternalLink" :size="14"
          /></a>
        </div>
      </li>
    </ul>
    <div class="dining-footer">
      <button
        v-if="offers.length > 3 && !expanded"
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
  list-style: none;
  padding: 0;
  margin: 16px 0 0;
}
.dining-offers li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  padding: 13px 0;
  border-top: 1px solid var(--line);
}
.dining-description {
  display: grid;
  gap: 5px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.dining-description strong {
  font-size: 14px;
  line-height: 1.4;
}
.dining-description span,
.dining-description small {
  font-size: 12px;
  line-height: 1.4;
}
.dining-price {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  font-size: 14px;
  white-space: nowrap;
}
.dining-price a,
.dining-footer a {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  color: var(--link, #2f6bff);
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
  .dining-offers li {
    gap: 10px;
  }
  .dining-price {
    font-size: 13px;
  }
}
</style>
