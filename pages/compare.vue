<script setup lang="ts">
import { packagesFor } from "~/shared/recipe/purchasing";
import { recommend } from "~/shared/recommendation";
import { retailStores } from "~/shared/yandex";
import {
  productSourceUrl,
  providerName,
  storeUrl,
  type StoreId,
  type RetailProduct,
} from "~/shared/yandex";
const { items, compareItems, notice, unresolved } = useBasket();
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
const recommendation = computed(() => recommend(offers.value));
const best = computed(() =>
  offers.value.find((o) => o.id === recommendation.value.best?.storeId),
);
const otherOffers = computed(() =>
  visible.value.filter((o) => o.id !== best.value?.id),
);
const storeName = (id: string) =>
  retailStores.find((s) => s.id === id)?.name || id;
const requiredMissing = (offer: (typeof offers.value)[number]) =>
  offer.lines.filter(
    (line) =>
      items.value.find((item) => item.productId === line.itemId)?.required &&
      (!line.selected?.available ||
        line.error ||
        offer.stockProblems.some((p) => p.itemId === line.itemId)),
  );
function openOffer(id: StoreId) {
  detail.value = id;
  copied.value = false;
  copyError.value = "";
}
async function copySplit() {
  try {
    await navigator.clipboard.writeText(
      recommendation.value
        .split!.groups.map(
          (group) =>
            `${storeName(group.storeId)}\n${group.lines.map((line) => `${line.selected!.name} · ${line.selected!.unit} × ${line.quantity}`).join("\n")}`,
        )
        .join("\n\n"),
    );
    notice.value = "Списки двух магазинов скопированы";
  } catch {
    copyError.value = "Не удалось скопировать список. Выделите товары ниже.";
  }
}
const detail = ref<StoreId | null>(null);
const selected = computed(() =>
  offers.value.find((o) => o.id === detail.value),
);
const expanded = ref<string | null>(null);
const copied = ref(false);
const copyError = ref("");
const requestKey = computed(() => keyFor(compareItems.value));
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
function refresh() {
  clearTimeout(refreshTimer);
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
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refresh, 200);
});
onBeforeUnmount(() => {
  clearTimeout(refreshTimer);
  if (pending.value) invalidate();
});
function choose(itemId: string, id: string) {
  const store = comparisons.value.find((o) => o.storeId === detail.value);
  const line = store?.lines.find((l) => l.itemId === itemId);
  if (line) {
    line.selected = line.alternatives.find((p) => p.id === id) || null;
    if (line.demand && line.selected) {
      const quantity = packagesFor(line.selected, line.demand);
      if (quantity === undefined) line.selected = null;
      else line.quantity = quantity;
    }
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
  <div class="inner-page comparison-page">
    <div class="flow-steps">
      <NuxtLink to="/">01 · Список</NuxtLink
      ><NuxtLink to="/basket">02 · Корзина</NuxtLink
      ><span class="active">03 · Где выгоднее</span>
    </div>
    <div class="page-heading">
      <div>
        <span class="eyebrow">ВЫБЕРИТЕ СВОЙ ВАРИАНТ</span>
        <h1>Где выгоднее</h1>
        <p class="muted">
          {{ quantityLabel(items.length, "позиция", "позиции", "позиций") }} ·
          {{ location.label }}
        </p>
      </div>
      <button
        v-if="items.length"
        class="secondary"
        :disabled="pending"
        @click="refresh"
      >
        <AppIcon name="RefreshCw" :size="16" />Обновить цены
      </button>
    </div>
    <p v-if="unresolved.length" class="info-note" role="status">
      Не весь рецепт собран: {{ unresolved.join(", ") }}. Ниже сравниваются
      только добавленные товары, а не полная стоимость рецепта.
    </p>
    <template v-if="items.length">
      <div v-if="pending" class="comparison-loading" role="status">
        <span class="spinner" />
        <h2>Сравниваем вашу корзину</h2>
        <p>
          Проверяем цены и наличие в шести магазинах. Иногда магазину нужно чуть
          больше времени.
        </p>
        <div class="skeleton" />
        <div class="skeleton short" />
        <NuxtLink to="/basket" class="text-button"
          >Вернуться к корзине</NuxtLink
        >
      </div>
      <div v-if="error" class="error-state" role="alert">
        <h2>Магазины не ответили</h2>
        <p>{{ error }}</p>
        <button class="primary" @click="refresh">Попробовать ещё раз</button
        ><NuxtLink to="/basket" class="text-button"
          >Корзина сохранена — вернуться</NuxtLink
        >
      </div>
      <template v-if="!pending && offers.length">
        <section v-if="best" class="recommended-offer">
          <div class="recommendation-label">
            <AppIcon name="Check" :size="18" />Выгоднее по стоимости товаров
          </div>
          <div class="recommended-main">
            <div class="store-identity">
              <span class="store-logo" :style="{ background: best.color }">{{
                best.letter
              }}</span>
              <div>
                <h2>{{ best.name }}</h2>
                <p>Найдена вся корзина</p>
                <NearbyStoresLink :store-id="best.id" />
              </div>
            </div>
            <div class="recommended-price">
              {{ money(best.subtotal) }} <small>BYN · за товары</small>
            </div>
          </div>
          <p v-if="recommendation.saving > 0" class="saving">
            Товары на {{ money(recommendation.saving) }} BYN дешевле, чем в
            {{ storeName(recommendation.baseline!) }}
          </p>
          <p v-else class="recommendation-reason">
            {{
              offers.filter((o) => o.complete).length === 1
                ? "Единственный магазин, где найдена вся корзина."
                : "Минимальная сумма среди найденных полных корзин."
            }}
          </p>
          <DeliveryCost :store-id="best.id" :subtotal="best.subtotal" />
          <button class="primary" @click="openOffer(best.id)">
            Проверить и перейти к покупке
            <AppIcon name="ArrowRight" :size="18" /></button
          ><small>Окончательную сумму подтвердит магазин</small>
        </section>
        <div v-else class="basket-notice">
          <strong>Целиком корзину пока не нашли</strong>
          <p>
            Ниже — доступные товары в каждом магазине. Проверьте недостающие
            позиции перед покупкой.
          </p>
        </div>
        <details v-if="recommendation.split" class="split-offer">
          <summary>
            <span
              ><AppIcon name="ShoppingBasket" :size="19" />{{
                recommendation.split.saving > 0
                  ? `Ещё ${money(recommendation.split.saving)} BYN можно сэкономить`
                  : "Весь список есть в двух магазинах"
              }}<small
                >Если купить в двух местах · без двух доставок и сборов</small
              ></span
            ><AppIcon name="ChevronDown" :size="18" />
          </summary>
          <p>
            Товары обойдутся в
            <strong>{{ money(recommendation.split.subtotal) }} BYN</strong>.
            Дополнительная доставка и время могут перекрыть выгоду. Проверьте
            выбранные упаковки.
          </p>
          <div
            v-for="group in recommendation.split.groups"
            :key="group.storeId"
          >
            <h3>{{ storeName(group.storeId) }}</h3>
            <NearbyStoresLink :store-id="group.storeId" />
            <DeliveryCost
              :store-id="group.storeId"
              :subtotal="
                group.lines.reduce(
                  (total, line) =>
                    total + (line.selected?.price || 0) * line.quantity,
                  0,
                )
              "
              context="split"
            />
            <ul>
              <li v-for="line in group.lines" :key="line.itemId">
                {{ line.selected!.name }} · {{ line.selected!.unit }} ×
                {{ line.quantity }}
              </li>
            </ul>
            <a
              class="text-button"
              :href="storeUrl(group.storeId)"
              target="_blank"
              rel="noopener noreferrer"
              >Открыть {{ storeName(group.storeId) }}
              <AppIcon name="ExternalLink" :size="14"
            /></a>
          </div>
          <button class="secondary" @click="copySplit">
            Скопировать оба списка
          </button>
        </details>
        <p v-if="copyError && !selected" class="error" role="alert">
          {{ copyError }}
        </p>
        <div class="compare-toolbar">
          <h2>{{ best ? "Другие варианты" : "Что нашли магазины" }}</h2>
          <label class="checkbox"
            ><input v-model="onlyComplete" type="checkbox" />Только
            полные</label
          >
        </div>
        <div class="offers">
          <article v-for="offer in otherOffers" :key="offer.id" class="offer">
            <div class="store-identity">
              <span class="store-logo" :style="{ background: offer.color }">{{
                offer.letter
              }}</span>
              <div>
                <h2>{{ offer.name }}</h2>
                <NearbyStoresLink :store-id="offer.id" />
                <span :class="offer.complete ? 'available' : 'unavailable'">{{
                  offer.hasError
                    ? "Не удалось проверить"
                    : offer.stockProblems.length
                      ? "Не хватает остатка"
                      : offer.complete
                        ? "Вся корзина"
                        : `${offer.lines.length - offer.missing.length} из ${offer.lines.length} позиций`
                }}</span
                ><small v-if="requiredMissing(offer).length" class="unavailable"
                  >Нет обязательных:
                  {{
                    requiredMissing(offer)
                      .map((l) => l.query)
                      .join(", ")
                  }}</small
                >
              </div>
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
                offer.complete ? "За все товары" : "За найденные товары"
              }}</span>
            </div>
            <DeliveryCost
              class="offer-delivery"
              :store-id="offer.id"
              :subtotal="offer.subtotal"
              :complete="offer.complete"
            />
            <button class="secondary" @click="openOffer(offer.id)">
              {{ offer.complete ? "Посмотреть" : "Проверить состав"
              }}<AppIcon name="ArrowRight" :size="16" />
            </button>
          </article>
        </div>
        <p v-if="!otherOffers.length" class="empty-search">
          Других {{ onlyComplete ? "полных " : "" }}корзин пока нет.
        </p>
        <details class="trust-details">
          <summary>Почему такая цена и как считаем выгоду</summary>
          <p>
            «Магазины рядом» открывает поиск сети на Яндекс Картах рядом с
            выбранной точкой. Цены и наличие в офлайн-магазине могут отличаться
            от онлайн-каталога.
          </p>
          <p>
            Сравниваем подобранные корзины с одинаковым списком и количеством
            позиций. Бренды и упаковки могут различаться. Экономия — разница с
            ближайшей по цене полной корзиной, а не обещание одинаковых товаров
            во всех магазинах.
          </p>
          <p>
            Неполные корзины не участвуют в выборе лучшей полной корзины. Цены
            из каталогов магазинов и Яндекс Еды, кеш до 2 минут. Рейтинг и
            экономия сравнивают только товары. Доставка показана отдельно по
            опубликованным условиям; неизвестные сборы не считаются нулевыми.
            Адрес, интервал, упаковка и скидки могут изменить сумму при
            оформлении.
          </p>
          <p v-for="offer in offers" :key="offer.id">
            {{ offer.name }} · проверено {{ time(offer.fetchedAt) }}
          </p>
        </details>
      </template>
    </template>
    <div v-else class="empty-state">
      <span class="empty-icon"
        ><AppIcon name="ShoppingBasket" :size="32"
      /></span>
      <h2>Сначала соберём корзину</h2>
      <p>Добавьте продукты — найдём выгодный магазин для вашего списка.</p>
      <NuxtLink to="/products" class="primary">Найти товары</NuxtLink>
    </div>
    <AppModal
      v-if="selected"
      class="comparison-modal"
      :title="`${selected.name} · состав корзины`"
      @close="detail = null"
      ><div class="comparison-scroll">
        <DeliveryCost
          :store-id="selected.id"
          :subtotal="selected.subtotal"
          :complete="selected.complete"
          conditions-only
        />
        <div class="comparison-lines">
          <div
            v-for="line in selected.lines"
            :key="line.itemId"
            class="comparison-line"
          >
            <h3 v-if="!line.selected || line.replacement">
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
                    {{ money(line.selected.price) }} BYN ×
                    {{ line.quantity }} уп.
                  </p>
                </div>
                <b>{{ money(line.selected.price * line.quantity) }} BYN</b>
              </div></template
            >
            <p v-else class="unavailable">
              {{ line.error || "Пока нет подходящего товара в наличии." }}
            </p>
            <p
              v-if="line.replacement && line.selected"
              class="replacement-note"
            >
              Подобрали замену
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
                v-if="
                  line.alternatives.every((p) => p.id === line.selected?.id)
                "
                class="muted"
              >
                Других вариантов пока нет.
              </p>
            </div>
          </div>
        </div>
        <p v-if="selected.stockProblems.length" class="error">
          Недостаточно остатка для повторяющихся товаров. Измените количество
          или выберите замену.
        </p>
      </div>
      <div class="comparison-footer">
        <div class="comparison-total">
          <span>{{ selected.lines.length }} позиций · за товары</span
          ><strong>{{ money(selected.subtotal) }} BYN</strong>
        </div>
        <DeliveryCost
          :store-id="selected.id"
          :subtotal="selected.subtotal"
          :complete="selected.complete"
          summary-only
        />
        <p>
          Список нужно добавить у магазина. Итог подтвердится при оформлении.
        </p>
        <NearbyStoresLink :store-id="selected.id" />
        <div class="comparison-footer-actions">
          <button class="secondary" @click="copy">
            {{ copied ? "Скопировано" : "Копировать список" }}
          </button>
          <p v-if="copyError" class="error" role="alert">{{ copyError }}</p>
          <a
            :href="storeUrl(selected.id)"
            target="_blank"
            rel="noopener noreferrer"
            class="primary"
            >Перейти в {{ selected.name
            }}<AppIcon name="ExternalLink" :size="17"
          /></a>
        </div>
      </div>
    </AppModal>
  </div>
</template>
