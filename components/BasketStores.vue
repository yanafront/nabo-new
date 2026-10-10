<script setup lang="ts">
import {
  retailStores,
  storeUrl,
  type StoreId,
  type RetailProduct,
  type CompareLine,
} from "~/shared/yandex";
import { retailProduct } from "~/shared/recipe-basket";
import {
  summarizeStoreBasket,
  cheapestCompleteBasket,
} from "~/shared/store-baskets";
const { items, compareItems, change, remove, addProduct } = useBasket();
const cart = useCartSync();
const {
  comparisons,
  location,
  compare,
  pending,
  error,
  fingerprint,
  keyFor,
  invalidate,
} = useRetail();
const active = ref<StoreId>(retailStores[0].id);
const userSelected = ref(false);
const autoSelected = ref(false);
const expanded = ref<string | null>(null);
const copied = ref(false);
const copyError = ref("");
const expectedIds = computed(() => items.value.map((item) => item.productId));
const offers = computed(() =>
  comparisons.value.map((offer) => ({
    ...offer,
    ...summarizeStoreBasket(offer, expectedIds.value),
  })),
);
const best = computed(() =>
  cheapestCompleteBasket(comparisons.value, expectedIds.value),
);
const selected = computed(() =>
  offers.value.find((offer) => offer.storeId === active.value),
);
const identity = computed(() =>
  retailStores.find((store) => store.id === active.value)!,
);
const busy = computed(
  () => cart.state.value === "saving" || cart.state.value === "loading",
);
const refreshing = computed(
  () => (pending.value || busy.value) && !comparisons.value.length,
);
const status = (id: StoreId) =>
  offers.value.find((offer) => offer.storeId === id);
const available = (line: CompareLine) =>
  !!line.selected?.available &&
  !line.error &&
  line.selected.storeId === active.value &&
  Number.isFinite(line.selected.price);
const alternatives = (line: CompareLine) =>
  line.alternatives.filter(
    (product) =>
      product.storeId === active.value &&
      product.available &&
      product.id !== line.selected?.id,
  );
const shownLines = computed(() =>
  expectedIds.value.map(
    (id) =>
      selected.value?.lines.find((line) => line.itemId === id) || {
        itemId: id,
        query: items.value.find((item) => item.productId === id)!.product!.name,
        quantity: items.value.find((item) => item.productId === id)!.quantity,
        selected: null,
        alternatives: [],
      },
  ),
);
let timer: ReturnType<typeof setTimeout> | undefined;
let disposed = false;
let attemptedKey = "";
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (
      disposed ||
      pending.value ||
      cart.state.value !== "saved" ||
      !items.value.length
    )
      return;
    const input = cart.comparisonItems();
    if (!input) return;
    const key = keyFor(input);
    // One automatic attempt per cart/address; old timestamps and failures must not poll.
    if (fingerprint.value === key || attemptedKey === key) return;
    attemptedKey = key;
    void compare(false);
  }, 250);
}
watch(
  [
    () => JSON.stringify(compareItems.value),
    () => location.value.lat,
    () => location.value.lon,
    () => cart.state.value,
    pending,
  ],
  schedule,
  { immediate: true },
);
watch(comparisons, () => {
  if (!userSelected.value && !autoSelected.value && offers.value.length) {
    active.value =
      best.value?.storeId ||
      offers.value.find((offer) => offer.found > 0)?.storeId ||
      active.value;
    autoSelected.value = true;
  }
  expanded.value = null;
});
function select(id: StoreId) {
  active.value = id;
  userSelected.value = true;
  expanded.value = null;
  copied.value = false;
}
function tabKey(event: KeyboardEvent, index: number) {
  const next =
    event.key === "ArrowRight"
      ? (index + 1) % retailStores.length
      : event.key === "ArrowLeft"
        ? (index + retailStores.length - 1) % retailStores.length
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? retailStores.length - 1
            : -1;
  if (next < 0) return;
  event.preventDefault();
  select(retailStores[next]!.id);
  const tab = (
    event.currentTarget as HTMLElement
  ).parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next];
  tab?.focus();
  tab?.scrollIntoView({ block: "nearest", inline: "nearest" });
}
async function replace(line: CompareLine, product: RetailProduct) {
  if (await addProduct(product, line.itemId)) expanded.value = null;
}
async function copy() {
  try {
    await navigator.clipboard.writeText(
      shownLines.value
        .map(
          (line) =>
            `${available(line) ? line.selected!.name : line.query} · ${line.quantity} уп.${available(line) ? "" : " — не найдено"}`,
        )
        .join("\n"),
    );
    copied.value = true;
    copyError.value = "";
  } catch {
    copyError.value = "Не удалось скопировать список. Попробуйте ещё раз.";
  }
}
onBeforeUnmount(() => {
  disposed = true;
  clearTimeout(timer);
  if (pending.value) invalidate();
});
</script>
<template>
  <section class="basket-stores" aria-label="Корзина по магазинам">
    <div class="basket-benefit" aria-live="polite">
      <template v-if="best && !refreshing">
        <span>Где выгоднее</span>
        <button class="text-button" @click="select(best.storeId)">
          <strong
            >{{
              retailStores.find((store) => store.id === best!.storeId)!.name
            }}
            · {{ money(best.subtotal) }} BYN</strong
          ><AppIcon name="ArrowRight" :size="16" />
        </button>
        <small>Вся корзина в наличии</small>
      </template>
      <template v-else
        ><span>{{
          refreshing
            ? "Проверяем цены и наличие в магазинах…"
            : "Полной корзины в наличии пока нет"
        }}</span
        ><small v-if="!refreshing && offers.length"
          >Сравните наличие во вкладках — суммы неполных корзин отличаются по
          составу.</small
        ></template
      >
    </div>
    <div class="basket-store-tabs" role="tablist" aria-label="Магазины корзины">
      <button
        v-for="(store, index) in retailStores"
        :id="`basket-tab-${store.id}`"
        :key="store.id"
        role="tab"
        :aria-selected="active === store.id"
        :aria-controls="`basket-panel-${store.id}`"
        :tabindex="active === store.id ? 0 : -1"
        :class="{ active: active === store.id }"
        @click="select(store.id)"
        @keydown="tabKey($event, index)"
      >
        <span class="tab-store-name"
          ><StoreBrand :store-id="store.id" size="compact"
        /></span>
        <strong>{{
          !refreshing && status(store.id)?.hasPrice
            ? `${money(status(store.id)!.subtotal)} BYN`
            : "—"
        }}</strong>
        <small
          :class="{ available: !refreshing && status(store.id)?.complete }"
          >{{
            refreshing
              ? "Проверяем…"
              : !status(store.id)
                ? "Нет ответа"
                : status(store.id)!.complete
                  ? "Всё в наличии"
                  : `${status(store.id)!.found} из ${items.length} найдено`
          }}</small
        >
      </button>
    </div>
    <div class="basket-layout store-basket-layout">
      <section
        :id="`basket-panel-${active}`"
        class="basket-list panel store-basket-panel"
        role="tabpanel"
        :aria-labelledby="`basket-tab-${active}`"
        :aria-busy="refreshing"
      >
        <div class="store-basket-heading">
          <div>
            <h2><StoreBrand :store-id="active" /></h2>
            <NearbyStoresLink :store-id="active" />
          </div>
          <button class="text-button" :disabled="refreshing" @click="compare()">
            <AppIcon name="RefreshCw" :size="14" />Обновить
          </button>
        </div>
        <p
          v-if="
            cart.state.value === 'saving' || cart.state.value === 'updating'
          "
          class="muted"
          role="status"
        >
          Сохраняем изменения…
        </p>
        <p v-if="refreshing" class="store-basket-status" role="status">
          <span class="spinner" />{{
            cart.state.value === "saving"
              ? "Сохраняем корзину…"
              : "Сравниваем цены и наличие…"
          }}
        </p>
        <div v-else-if="error" class="store-basket-status error" role="alert">
          {{ error
          }}<button class="text-button" @click="compare()">Повторить</button>
        </div>
        <p v-else-if="!selected" class="store-basket-status">
          Магазин не вернул данные. Попробуйте обновить сравнение.
        </p>
        <template v-else>
          <p v-if="!selected.complete" class="basket-price-note" role="status">
            {{
              selected.hasError
                ? "Часть товаров не удалось проверить."
                : selected.stockProblems.length
                  ? "Для части товаров не хватает количества в наличии."
                  : `Найдено ${selected.found} из ${items.length} позиций.`
            }}
            Сумма ниже — за найденные товары.
          </p>
          <div
            v-for="line in shownLines"
            :key="line.itemId"
            class="store-product-line"
          >
            <ProductRow
              v-if="available(line)"
              :product="retailProduct(line.selected!)"
              :preview-product="line.selected!"
              :quantity="line.quantity"
              @change="change(line.itemId, $event)"
              @remove="remove(line.itemId)"
              @replace="
                expanded = expanded === line.itemId ? null : line.itemId
              "
            />
            <div v-else class="store-missing-row">
              <span class="store-missing-icon"
                ><AppIcon name="ShoppingBasket" :size="22"
              /></span>
              <div>
                <strong>{{ line.query }}</strong
                ><small
                  >{{ line.error ? "Не удалось проверить" : "Нет в наличии" }} ·
                  {{ line.quantity }} уп.</small
                >
              </div>
              <button
                class="text-button"
                :aria-expanded="expanded === line.itemId"
                @click="
                  expanded = expanded === line.itemId ? null : line.itemId
                "
              >
                Заменить
              </button>
              <button
                class="icon-button"
                :aria-label="`Удалить: ${line.query}`"
                @click="remove(line.itemId)"
              >
                <AppIcon name="X" :size="16" />
              </button>
            </div>
            <div v-if="expanded === line.itemId" class="store-replacements">
              <p class="muted">Варианты в {{ identity.name }}</p>
              <button
                v-for="product in alternatives(line)"
                :key="product.id"
                class="store-replacement"
                :disabled="busy"
                @click="replace(line, product)"
              >
                <ProductImage :src="product.image" /><span
                  ><strong>{{ product.name }}</strong
                  ><small
                    >{{ product.unit }} · {{ money(product.price) }} BYN</small
                  ></span
                ><span class="text-button">Выбрать</span>
              </button>
              <p v-if="!alternatives(line).length" class="muted">
                Других вариантов магазин не предложил.
              </p>
              <NuxtLink
                class="text-button"
                :to="{
                  path: '/products',
                  query: { q: line.query, store: active, replace: line.itemId },
                }"
                >Найти другую замену</NuxtLink
              >
            </div>
          </div>
          <div class="store-list-footer">
            <NuxtLink to="/products" class="text-button"
              ><AppIcon name="Plus" :size="16" />Добавить товары</NuxtLink
            ><button class="text-button" @click="copy">
              {{ copied ? "Скопировано" : "Копировать список" }}
            </button>
          </div>
          <p v-if="copyError" class="error" role="alert">{{ copyError }}</p>
        </template>
      </section>
      <aside class="basket-summary" aria-label="Итог выбранного магазина">
        <div class="summary-total" aria-live="polite">
          <span
            >{{ identity.name }} ·
            {{
              !refreshing && selected
                ? `${selected.found} из ${items.length} позиций`
                : `${items.length} позиций`
            }}</span
          ><strong
            >{{
              !refreshing && selected?.hasPrice ? money(selected.subtotal) : "—"
            }}
            <small v-if="!refreshing && selected?.hasPrice">BYN</small
            ><span
              v-if="!refreshing && selected && !selected.complete"
              class="summary-partial"
              >За найденные товары</span
            ></strong
          >
        </div>
        <p class="basket-store-summary">
          {{
            selected?.complete
              ? "Вся корзина в наличии"
              : "Проверьте недостающие товары в списке."
          }}
        </p>
        <div class="basket-actions">
          <a
            v-if="!refreshing && selected?.hasPrice"
            :href="storeUrl(active)"
            target="_blank"
            rel="noopener noreferrer"
            class="primary full"
            >Перейти в {{ identity.name
            }}<AppIcon name="ExternalLink" :size="16" /></a
          ><button v-else class="primary full" disabled>
            {{ refreshing ? "Проверяем…" : "Нет товаров" }}
          </button>
        </div>
        <p class="basket-next-step">
          Список нужно добавить на сайте магазина. Доставка и сборы отдельно.
        </p>
      </aside>
    </div>
  </section>
</template>
<style scoped>
.basket-stores {
  min-width: 0;
}
.basket-benefit {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 14px;
  padding: 12px 16px;
  margin-bottom: 12px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: #f8ffe8;
  font-size: 13px;
}
.basket-benefit > span {
  font-weight: 600;
}
.basket-benefit small {
  color: var(--muted);
  font-size: 12px;
}
.basket-benefit .text-button {
  min-width: 0;
  min-height: 28px;
}
.basket-store-tabs {
  position: sticky;
  top: 0;
  z-index: 10;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
  background: white;
  padding: 8px 0 12px;
}
.basket-store-tabs > button {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: white;
  text-align: left;
  cursor: pointer;
}
@media (hover: hover) {
  .basket-store-tabs > button:hover {
    border-color: var(--blue, #2f6bff);
    box-shadow: 0 3px 12px rgb(15 15 16 / 8%);
  }
}
.basket-store-tabs > button.active {
  border-color: var(--blue, #2f6bff);
  background: white;
  box-shadow: inset 0 0 0 1px var(--blue, #2f6bff);
}
.tab-store-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
}
.store-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.basket-store-tabs strong {
  font-size: 17px;
}
.basket-store-tabs small {
  font-size: 11px;
  color: var(--muted);
}
.basket-store-tabs small.available {
  color: #396200;
}
.store-basket-panel {
  min-width: 0;
}
.store-basket-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
}
.store-basket-heading h2 {
  font-size: 17px;
  margin: 0;
}
.store-basket-heading :deep(.text-button) {
  font-size: 12px;
}
.store-basket-status {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 18px 0;
  font-size: 13px;
}
.store-missing-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  padding: 14px 0;
  border-bottom: 1px solid var(--line);
}
.store-missing-row > div {
  min-width: 0;
  overflow-wrap: anywhere;
}
.store-missing-row strong {
  font-size: 13px;
}
.store-missing-row small {
  display: block;
  color: var(--muted);
  font-size: 11px;
}
.store-missing-icon {
  color: var(--muted);
}
.store-missing-row .text-button {
  font-size: 12px;
}
.store-replacements {
  background: #f7f8fa;
  border-radius: 12px;
  padding: 10px;
  margin-bottom: 10px;
}
.store-replacements > p {
  margin: 0 0 8px;
  font-size: 12px;
}
.store-replacement {
  width: 100%;
  min-width: 0;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border: 0;
  border-bottom: 1px solid var(--line);
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.store-replacement > span {
  min-width: 0;
  overflow-wrap: anywhere;
}
.store-replacement strong {
  font-size: 12px;
}
.store-replacement small {
  display: block;
  font-size: 11px;
  color: var(--muted);
}
.store-replacement :deep(.product-image) {
  width: 36px;
  height: 42px;
}
.store-list-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 0;
}
.store-list-footer .text-button {
  font-size: 12px;
}
:deep(.basket-summary) {
  top: 122px;
}
@media (max-width: 760px) {
  :deep(.basket-summary) {
    top: auto;
  }
  .basket-store-tabs {
    display: flex;
    overflow-x: auto;
    gap: 6px;
    scrollbar-width: thin;
  }
  .basket-store-tabs > button {
    flex: 0 0 128px;
    padding: 10px;
  }
  .basket-store-tabs strong {
    font-size: 15px;
  }
  .basket-benefit {
    padding: 10px 12px;
    gap: 4px 8px;
  }
  .basket-benefit small {
    width: 100%;
  }
  .store-missing-row {
    grid-template-columns: 32px minmax(0, 1fr) auto auto;
    gap: 6px;
  }
  .store-replacement {
    grid-template-columns: 32px minmax(0, 1fr) auto;
    gap: 8px;
  }
  .store-replacement .text-button {
    font-size: 11px;
  }
}
</style>
