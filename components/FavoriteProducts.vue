<script setup lang="ts">
import { retailStores, type ProductResult } from "~/shared/yandex";
const { open: preview } = useProductPreview();
const { favorites, status, error, load, key } = useFavorites();
const { location } = useRetail();
const { resolveProducts } = useApi();
const limit = ref(24);
const results = ref<Record<string, ProductResult>>({});
const resolving = ref(false);
const resolveError = ref("");
const visible = computed(() =>
  [...favorites.value]
    .sort(
      (a, b) =>
        retailStores.findIndex((store) => store.id === a.storeId) -
        retailStores.findIndex((store) => store.id === b.storeId),
    )
    .slice(0, limit.value),
);
let controller: AbortController | undefined;
let revision = 0;
async function refreshProducts() {
  controller?.abort();
  const current = ++revision;
  results.value = {};
  resolveError.value = "";
  if (status.value !== "ready" || !visible.value.length) {
    resolving.value = false;
    return;
  }
  const abort = new AbortController();
  controller = abort;
  resolving.value = true;
  const references = visible.value.map((p) => ({ ...p }));
  const point = { ...location.value };
  try {
    const found: Record<string, ProductResult> = {};
    for (let offset = 0; offset < references.length; offset += 200) {
      const batch = references.slice(offset, offset + 200);
      const response = await resolveProducts(
        { items: batch, location: point },
        abort.signal,
      );
      if (current !== revision) return;
      for (const reference of batch) {
        const result = response.items.find(
          (item) => key(item) === key(reference),
        );
        if (result) found[key(reference)] = result;
      }
      results.value = { ...found };
    }
  } catch {
    if (current === revision && !abort.signal.aborted)
      resolveError.value = "Не удалось обновить товары. Попробуйте ещё раз.";
  } finally {
    if (current === revision) resolving.value = false;
  }
}
function productFor(reference: (typeof favorites.value)[number]) {
  const result = results.value[key(reference)];
  const product = result?.product;
  return result?.status === "ok" && product && key(product) === key(reference)
    ? product
    : null;
}
watch(
  () =>
    JSON.stringify([
      status.value,
      visible.value,
      location.value.lat,
      location.value.lon,
    ]),
  refreshProducts,
);
onMounted(async () => {
  await load(true);
});
onBeforeUnmount(() => {
  revision++;
  controller?.abort();
});
</script>
<template>
  <section class="favorite-products" aria-label="Любимые товары">
    <div v-if="status === 'guest'" class="empty-state">
      <AppIcon name="Heart" :size="32" />
      <h2>Любимые товары — в вашем аккаунте</h2>
      <p>
        Войдите, чтобы сохранять товары и открывать их на других устройствах.
      </p>
      <NuxtLink
        :to="{ path: '/account', query: { returnTo: '/saved?tab=products' } }"
        class="primary"
        >Войти в аккаунт</NuxtLink
      >
    </div>
    <div
      v-else-if="status === 'idle' || status === 'loading'"
      class="info-note"
      role="status"
    >
      Загружаем любимые товары…
    </div>
    <div v-else-if="status === 'error'" class="error-state" role="alert">
      <p>{{ error }}</p>
      <button class="secondary" @click="load(true)">Повторить</button>
    </div>
    <template v-else-if="favorites.length">
      <div class="favorite-list-heading">
        <p>
          {{ quantityLabel(favorites.length, "товар", "товара", "товаров") }} ·
          {{ location.label }}
        </p>
        <button
          class="text-button"
          :disabled="resolving"
          @click="refreshProducts"
        >
          {{ resolving ? "Обновляем…" : "Обновить цены" }}
        </button>
      </div>
      <p class="muted favorite-hint">
        Подходящие любимые товары учитываются при подборе корзины.
      </p>
      <p v-if="resolveError" class="error" role="alert">{{ resolveError }}</p>
      <div class="favorite-grid">
        <template v-for="reference in visible" :key="key(reference)">
          <div v-if="productFor(reference)" class="favorite-result">
            <span class="favorite-store"
              ><StoreBrand :store-id="reference.storeId" size="compact" /></span
            ><CatalogProductCard :product="productFor(reference)!" />
          </div>
          <article v-else class="panel favorite-unavailable">
            <div class="favorite-unavailable-head">
              <strong
                ><StoreBrand
                  :store-id="reference.storeId"
                  size="compact" /></strong
              ><FavoriteButton
                :store-id="reference.storeId"
                :id="reference.id"
              />
            </div>
            <p class="muted">Товар № {{ reference.id }}</p>
            <p>
              {{
                resolving && !results[key(reference)]
                  ? "Обновляем данные…"
                  : results[key(reference)]?.status === "not_found"
                    ? "Товар сейчас не найден в магазине."
                    : "Не удалось получить актуальные данные товара."
              }}
            </p>
            <a
              :href="`/product/${reference.storeId}/${encodeURIComponent(reference.id)}`"
              class="text-button"
              @click.prevent="
                preview({ storeId: reference.storeId, id: reference.id })
              "
              >Открыть товар</a
            >
          </article>
        </template>
      </div>
      <button
        v-if="visible.length < favorites.length"
        class="secondary favorite-more"
        :disabled="resolving"
        @click="limit += 24"
      >
        Показать ещё
      </button>
    </template>
    <div v-else class="empty-state">
      <AppIcon name="Heart" :size="32" />
      <h2>Сохраните любимые товары</h2>
      <p>Нажимайте на сердечко в каталоге — товары появятся здесь.</p>
      <NuxtLink to="/products" class="primary">Найти товары</NuxtLink>
    </div>
  </section>
</template>
<style scoped>
.favorite-list-heading,
.favorite-unavailable-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.favorite-list-heading p {
  font-size: 13px;
  color: var(--muted);
}
.favorite-hint {
  font-size: 13px;
  margin: 0 0 20px;
}
.favorite-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}
.favorite-result {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.favorite-result :deep(.catalog-product-card) {
  flex: 1;
}
.favorite-store {
  font-size: 12px;
  color: var(--muted);
  margin: 0 0 8px 4px;
}
.favorite-unavailable {
  padding: 16px;
  font-size: 13px;
  overflow-wrap: anywhere;
}
.favorite-more {
  display: block;
  margin: 20px auto;
}
@media (max-width: 900px) {
  .favorite-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 360px) {
  .favorite-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
