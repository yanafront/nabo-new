<script setup lang="ts">
import {
  productSourceUrl,
  providerName,
  storeUrl,
  type StoreId,
  type RetailProduct,
} from "~/shared/yandex";
const { items, compareItems } = useBasket();
const {
  offers,
  comparisons,
  location,
  pending,
  error,
  compare,
  keyFor,
  fingerprint,
  invalidate,
} = useRetail();
const onlyComplete = ref(false);
const visible = computed(() =>
  offers.value.filter((o) => !onlyComplete.value || o.complete),
);
const detail = ref<StoreId | null>(null);
const selected = computed(() =>
  offers.value.find((o) => o.id === detail.value),
);
const expanded = ref<string | null>(null);
const copied = ref(false);
const copyError = ref("");
const requestKey = computed(() => keyFor(compareItems.value));
function refresh() {
  if (items.value.length) compare(compareItems.value);
}
onMounted(() => {
  if (
    fingerprint.value !== requestKey.value ||
    offers.value.some((o) => Date.now() - Date.parse(o.fetchedAt) > 120000)
  )
    refresh();
});
watch(requestKey, () => {
  detail.value = null;
  refresh();
});
onBeforeUnmount(() => {
  if (pending.value) invalidate();
});
function choose(itemId: string, id: string) {
  const store = comparisons.value.find((o) => o.storeId === detail.value);
  const line = store?.lines.find((l) => l.itemId === itemId);
  if (line) {
    line.selected = line.alternatives.find((p) => p.id === id) || null;
    line.replacement = line.selected?.name !== line.query;
    expanded.value = null;
  }
}
async function copy() {
  try {
    await navigator.clipboard.writeText(
      selected.value?.lines
        .map(
          (l) =>
            `${l.selected?.name || l.query} · ${l.selected?.unit || "не найдено"} — ${l.quantity} уп.`,
        )
        .join("\n") || "",
    );
    copied.value = true;
    copyError.value = "";
  } catch {
    copyError.value =
      "Не удалось скопировать. Выделите названия товаров в списке.";
  }
}
const time = (value: string) =>
  new Date(value).toLocaleTimeString("ru-BY", {
    hour: "2-digit",
    minute: "2-digit",
  });
</script>
<template>
  <div class="inner-page">
    <NuxtLink to="/basket" class="back-link"
      ><AppIcon name="ArrowLeft" :size="16" /> К корзине</NuxtLink
    >
    <div class="page-heading">
      <div>
        <h1>Сравним магазины</h1>
        <p class="muted">
          {{ location.label }} · {{ items.length }} позиций · Только стоимость
          товаров
        </p>
      </div>
      <button
        v-if="items.length"
        class="secondary"
        :disabled="pending"
        @click="refresh"
      >
        <AppIcon name="RefreshCw" :size="16" />Обновить
      </button>
    </div>
    <template v-if="items.length"
      ><div v-if="pending" class="live-loading panel" role="status">
        <span class="spinner" />
        <div>
          <h2>Проверяем шесть магазинов</h2>
          <p>Получаем реальные товары, цены и наличие…</p>
        </div>
      </div>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <template v-if="!pending && offers.length"
        ><div class="compare-banner">
          <div>
            <h3>Один список — разные корзины</h3>
            <p>
              Если нужного товара нет, подбираем замену. Бренды и упаковки могут
              отличаться. Сравниваем сумму выбранных товаров без доставки и
              сборов.
            </p>
          </div>
        </div>
        <div class="compare-toolbar">
          <h2>Подобранные корзины</h2>
          <label class="checkbox"
            ><input v-model="onlyComplete" type="checkbox" /> Только
            полные</label
          >
        </div>
        <div class="offers">
          <article
            v-for="offer in visible"
            :key="offer.id"
            class="offer panel"
            :class="{ best: offer.complete && offer.id === offers[0]?.id }"
          >
            <div
              v-if="offer.complete && offer.id === offers[0]?.id"
              class="best-label"
            >
              МИНИМУМ СРЕДИ ПОЛНЫХ КОРЗИН
            </div>
            <div class="store-identity">
              <span class="store-logo" :style="{ background: offer.color }">{{
                offer.letter
              }}</span>
              <div>
                <h2>{{ offer.name }}</h2>
                <span :class="offer.complete ? 'available' : 'unavailable'">{{
                  offer.hasError
                    ? "Не удалось проверить"
                    : offer.stockProblems.length
                      ? "Недостаточно остатка"
                      : offer.complete
                        ? "Все позиции подобраны"
                        : `${offer.lines.length - offer.missing.length} из ${offer.lines.length} подобрано`
                }}</span>
              </div>
            </div>
            <div class="offer-breakdown">
              <span>Доставка и сборы <b>При оформлении</b></span
              ><small>Проверено в {{ time(offer.fetchedAt) }}</small
              ><small v-if="offer.hasError" class="unavailable">{{
                offer.lines.find((l) => l.error)?.error
              }}</small>
            </div>
            <div class="offer-total">
              <strong
                >{{
                  offer.lines.some((l) => l.selected)
                    ? money(offer.subtotal)
                    : "—"
                }}
                <small v-if="offer.lines.some((l) => l.selected)"
                  >BYN</small
                ></strong
              ><span>{{
                offer.complete
                  ? "Товары без доставки"
                  : "Только подобранные позиции"
              }}</span>
            </div>
            <button
              class="primary"
              @click="
                detail = offer.id;
                copied = false;
                copyError = '';
              "
            >
              Проверить состав<AppIcon name="ArrowRight" :size="17" />
            </button>
          </article>
        </div>
        <p v-if="!visible.length" class="empty-search">
          Полных корзин пока нет. Отключите фильтр и выберите замены.
        </p>
        <p class="compare-disclaimer">
          Цены из Яндекс Еды, Е-доставки и каталога «Соседей», кеш до 2 минут.
          Наличие и доставка по адресу могут измениться. Итог проверьте в
          магазине.
        </p></template
      ></template
    >
    <div v-else class="empty-state">
      <h2>Сначала соберём корзину</h2>
      <NuxtLink to="/" class="primary">Выбрать продукты</NuxtLink>
    </div>
    <AppModal
      v-if="selected"
      :title="`${selected.name} · состав корзины`"
      @close="detail = null"
      ><div class="comparison-lines">
        <div
          v-for="line in selected.lines"
          :key="line.itemId"
          class="comparison-line"
        >
          <h3>
            {{ line.query }} <small>× {{ line.quantity }}</small>
          </h3>
          <template v-if="line.selected"
            ><div class="chosen-product">
              <ProductImage :src="line.selected.image" />
              <div>
                <strong>{{ line.selected.name }}</strong>
                <a
                  :href="productSourceUrl(line.selected)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-button product-source-link"
                  >Проверить в {{ providerName(line.selected.storeId) }}
                  <AppIcon name="ExternalLink" :size="12"
                /></a>
                <p>
                  {{ line.selected.unit }} ·
                  {{ money(line.selected.price) }} BYN / уп.
                </p>
              </div>
              <b>{{ money(line.selected.price * line.quantity) }} BYN</b>
            </div></template
          >
          <p v-else class="unavailable">
            {{ line.error || "Пока нет подходящего товара в наличии." }}
          </p>
          <p v-if="line.replacement && line.selected" class="replacement-note">
            Подобрали замену · {{ line.selected.unit }} ×
            {{ line.quantity }} уп.
          </p>
          <button
            v-if="line.alternatives.length"
            class="text-button"
            :aria-expanded="expanded === line.itemId"
            @click="expanded = expanded === line.itemId ? null : line.itemId"
          >
            {{
              expanded === line.itemId
                ? "Скрыть варианты"
                : line.selected
                  ? "Заменить товар"
                  : "Выбрать замену"
            }}
          </button>
          <div v-if="expanded === line.itemId" class="replacement-options">
            <button
              v-for="product in line.alternatives.filter(
                (p) => p.id !== line.selected?.id,
              )"
              :key="product.id"
              class="replacement-option"
              @click="choose(line.itemId, product.id)"
            >
              <ProductImage :src="product.image" />
              <span
                ><strong>{{ product.name }}</strong
                ><small
                  >{{ product.unit }} · {{ money(product.price) }} BYN /
                  уп.</small
                ></span
              >
              <span class="replacement-action">Выбрать</span>
            </button>
            <p
              v-if="line.alternatives.every((p) => p.id === line.selected?.id)"
              class="muted"
            >
              Других вариантов пока нет.
            </p>
          </div>
        </div>
      </div>
      <p v-if="selected.stockProblems.length" class="error">
        Недостаточно остатка для повторяющихся товаров. Измените количество или
        выберите замену.
      </p>
      <div class="info-note">
        Товары: {{ money(selected.subtotal) }} BYN. Доставка и сборы — при
        оформлении. Автоматический перенос корзины пока не подключён.
      </div>
      <button class="secondary full" @click="copy">
        {{ copied ? "Список скопирован" : "Скопировать список продуктов" }}
      </button>
      <p v-if="copyError" class="error" role="alert">{{ copyError }}</p>
      <a
        :href="storeUrl(selected.id)"
        target="_blank"
        rel="noopener noreferrer"
        class="primary full retailer-link"
        >Открыть {{ selected.name }}<AppIcon
          name="ExternalLink"
          :size="17" /></a
    ></AppModal>
  </div>
</template>
