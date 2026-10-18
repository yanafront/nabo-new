<script setup lang="ts">
import { PRIMARY_SITE_ORIGIN } from "~/shared/seo/core";
import {
  perServing,
  scaledIngredients,
  ingredientAmount,
  type Recipe,
  type Ingredient,
} from "~/shared/recipe/model";
import type { DiningResult } from "~/shared/dining/delivio";
import { recipeSchema, breadcrumb } from "~/shared/seo/core";
import { retailStores } from "~/shared/yandex";
import { recipePurchaseRequest } from "~/shared/recipe/purchasing";
const { categories: currentCategories } = await useRecipeCategories();
const route = useRoute();
const recipeSeoOrigin = PRIMARY_SITE_ORIGIN;
const slug = String(route.params.slug);
const { data, error, refresh } = await useAsyncData(`recipe:${slug}`, () =>
  $fetch<{ recipe: Recipe; ingredients: Ingredient[] }>(
    `/api/recipes/${encodeURIComponent(slug)}`,
  ),
);
const recipe = computed(() => data.value?.recipe);
if (error.value?.statusCode === 404)
  throw createError({ statusCode: 404, statusMessage: "Рецепт не найден" });
if (import.meta.server && error.value)
  setResponseStatus(useRequestEvent()!, error.value.statusCode || 503);

const dictionary = computed(() => data.value?.ingredients || []);
const servings = ref(
  Math.min(
    30,
    Math.max(1, Number(route.query.servings) || recipe.value?.servings || 2),
  ),
);
usePageSeo(() => ({
  noindex: !recipe.value,
  title: `${recipe.value?.title || "Рецепт недоступен"} — рецепт и продукты для корзины | Nabo`,
  description:
    recipe.value?.description ||
    `Как приготовить ${recipe.value?.title}: ингредиенты, пошаговый рецепт, стоимость продуктов и предложения готового блюда.`,
  image: recipe.value?.image,
  schemas: recipe.value
    ? [
        recipeSchema(
          recipe.value,
          recipeSeoOrigin,
          servings.value,
          currentCategories.value.find((c) => c.id === recipe.value?.categoryId)
            ?.title,
        ),
        breadcrumb(recipeSeoOrigin, [
          { name: "Главная", path: "/" },
          { name: "Рецепты", path: "/recipes" },
          { name: recipe.value.title, path: `/recipes/${slug}` },
        ]),
      ]
    : [],
}));
const initialDining = ref<DiningResult | null>(null);
if (import.meta.server && recipe.value) {
  try {
    initialDining.value = await $fetch<DiningResult>("/api/dining/search", {
      query: { q: recipe.value.title, lat: 53.9, lon: 27.5667 },
      timeout: 2500,
      retry: 0,
    });
  } catch {
    /* Recipe HTML stays available during a dining provider outage. */
  }
}
const excluded = ref<string[]>([]);
const imageFailed = ref(false);
const ingredientsOpen = ref(false);
const foundProductsOpen = ref(false);
const failedProductImages = ref(new Set<string>());
const loadedProductImages = ref(new Set<string>());
const priceStoreName = computed(
  () => retailStores.find((store) => store.id === priceStore.value)?.name,
);
function closeFoundProducts() {
  if (resolving.value) controller?.abort();
  foundProductsOpen.value = false;
}
function closeIngredients() {
  if (resolving.value) controller?.abort();
  ingredientsOpen.value = false;
}
const { resolve, resolving, resolveError } = useRecipeBasket();
const { items } = useBasket();
resolveError.value = "";
const localError = ref("");
let controller: AbortController | undefined;
const nutrition = computed(() => recipe.value && perServing(recipe.value));
const rows = computed(() =>
  recipe.value
    ? scaledIngredients(recipe.value, servings.value).map((i, index) => ({
        i,
        index,
        key: String(index),
        entry: dictionary.value.find((d) => d.id === i.ingredientId),
      }))
    : [],
);
const main = computed(() => rows.value.filter((r) => !r.entry?.pantry));
const pantry = computed(() => rows.value.filter((r) => r.entry?.pantry));
const request = computed(() =>
  recipe.value
    ? recipePurchaseRequest(
        recipe.value,
        dictionary.value,
        servings.value,
        excluded.value,
      )
    : null,
);
const price = useRecipeStorePrice(request);
const {
  storeId: priceStore,
  estimate,
  loading: priceLoading,
  error: priceError,
} = price;
watch(
  [recipe, dictionary],
  ([current, entries]) => {
    if (!current || excluded.value.length) return;
    // Pantry ingredients are normally already in the kitchen and should not
    // prevent the first useful basket from being assembled.
    excluded.value = current.ingredients
      .map((ingredient, index) =>
        entries.find((entry) => entry.id === ingredient.ingredientId)?.pantry
          ? String(index)
          : undefined,
      )
      .filter((index): index is string => index !== undefined);
  },
  { immediate: true },
);
async function build() {
  localError.value = "";
  if (!request.value) return;
  if (priceLoading.value || !estimate.value.items.length) return;
  controller = new AbortController();
  if (
    await resolve(
      request.value,
      controller.signal,
      items.value.length > 0,
      estimate.value,
    )
  )
    await navigateTo("/basket");
}
onBeforeUnmount(() => {
  controller?.abort();
});
</script>
<template>
  <div class="inner-page recipe-detail">
    <NuxtLink class="back-link" to="/recipes"
      ><AppIcon name="ArrowLeft" :size="16" />Что приготовить</NuxtLink
    >
    <div v-if="error || !recipe" class="info-note">
      <h1>Рецепт недоступен</h1>
      <button class="secondary" @click="refresh()">Повторить</button>
    </div>
    <template v-else>
      <div class="recipe-detail-hero">
        <div class="recipe-cover">
          <img
            v-if="recipe.image && !imageFailed"
            :src="recipe.image"
            :alt="recipe.title"
            width="800"
            height="600"
            loading="eager"
            fetchpriority="high"
            decoding="async"
            @error="imageFailed = true"
          />
          <div v-else class="dish-placeholder">
            <AppIcon name="ShoppingBasket" :size="64" /><span
              >Соберите продукты для этого блюда</span
            >
          </div>
        </div>
        <div class="recipe-intro">
          <h1>{{ recipe.title }}</h1>
          <p class="muted">{{ recipe.description }}</p>
          <div class="recipe-facts">
            <span v-if="recipe.cookingTime !== undefined"
              ><AppIcon name="Clock" :size="17" />{{
                recipe.cookingTime
              }}
              мин</span
            ><span v-if="recipe.difficulty">{{
              { easy: "Легко", medium: "Средняя сложность", hard: "Сложно" }[
                recipe.difficulty
              ]
            }}</span>
          </div>
          <RecipeNutrition v-if="nutrition" :nutrition="nutrition" compact />
          <p class="muted nutrition-caption">
            {{
              nutrition
                ? "Значения могут отличаться в зависимости от выбранных продуктов."
                : "Для этого рецепта пищевая ценность пока не указана."
            }}
          </p>
          <div class="recipe-actions">
            <button class="primary" @click="ingredientsOpen = true">
              <AppIcon name="ShoppingBasket" :size="18" />Собрать корзину
            </button>
            <a class="recipe-steps-link" href="#recipe-steps-title"
              >Как приготовить <AppIcon name="ChevronDown" :size="16"
            /></a>
          </div>
        </div>
      </div>
      <RecipeDining :title="recipe.title" :initial-result="initialDining">
        <template #cook-summary>
          <div class="cook-summary-head">
            <h2>Приготовить дома</h2>
            <label class="price-store-label">
              <span class="sr-only">Магазин для продуктов рецепта</span>
              <select
                v-model="priceStore"
                aria-label="Магазин для продуктов рецепта"
                :disabled="resolving"
              >
                <option
                  v-for="store in retailStores"
                  :key="store.id"
                  :value="store.id"
                >
                  {{ store.name }}
                </option>
              </select>
            </label>
          </div>
          <span v-if="priceLoading" class="price-loading" role="status"
            ><span class="spinner" />Считаем стоимость…</span
          >
          <div v-else-if="estimate.items.length" class="cook-price-row">
            <strong class="cook-price"
              >{{ !estimate.complete ? "от " : ""
              }}{{ money(estimate.total) }} BYN</strong
            >
            <span v-if="estimate.complete" class="portion-price"
              >≈ {{ money(estimate.total / servings) }} BYN / порция</span
            >
          </div>
          <strong v-else class="cook-price">{{
            request?.items.length
              ? "Не удалось подобрать"
              : "Нет продуктов к покупке"
          }}</strong>
          <p v-if="!priceLoading" class="muted price-caption">
            {{
              estimate.complete
                ? "Все продукты"
                : `Найдено ${estimate.matched} из ${estimate.requested}`
            }}
            · на {{ quantityLabel(servings, "порцию", "порции", "порций") }}
          </p>
          <p
            v-if="estimate.items.length && !priceLoading"
            class="muted price-caption"
          >
            Целые упаковки · без доставки
          </p>

          <button
            v-if="estimate.items.length && !priceLoading"
            class="text-button found-products-trigger"
            @click="foundProductsOpen = true"
          >
            Посмотреть товары <AppIcon name="ArrowRight" :size="14" />
          </button>
          <button
            v-if="priceError && !priceLoading"
            class="text-button price-retry"
            @click="price.refresh()"
          >
            Повторить расчёт
          </button>
        </template>
        <template #cook-content>
          <div class="recipe-body">
            <section
              class="recipe-composition"
              aria-labelledby="recipe-composition-title"
            >
              <div class="composition-head">
                <h2 id="recipe-composition-title">Ингредиенты</h2>
                <button class="text-button" @click="ingredientsOpen = true">
                  Изменить
                </button>
              </div>
              <p class="muted composition-servings">
                На {{ quantityLabel(servings, "порцию", "порции", "порций") }}
              </p>
              <ul class="composition-list">
                <li v-for="row in rows" :key="row.key">
                  <span
                    >{{ row.i.name
                    }}<small v-if="row.i.optional"> · по желанию</small></span
                  ><span class="muted">{{ ingredientAmount(row.i) }}</span>
                </li>
              </ul>
              <button
                class="secondary composition-action"
                @click="ingredientsOpen = true"
              >
                Выбрать продукты для корзины<AppIcon
                  name="ArrowRight"
                  :size="16"
                />
              </button>
            </section>
            <section
              class="recipe-instructions"
              aria-labelledby="recipe-steps-title"
            >
              <h2 id="recipe-steps-title">Как приготовить</h2>
              <ol v-if="recipe.instructions?.length">
                <li
                  v-for="(step, n) in recipe.instructions"
                  :key="n"
                  :id="`step-${n + 1}`"
                >
                  {{ step.text }}
                </li>
              </ol>
              <p v-else>Шаги приготовления не переданы источником.</p>
              <details class="recipe-source">
                <summary>Источник и фото</summary>
                <p class="muted">
                  Источник данных:
                  <a
                    v-if="recipe.sourceUrl"
                    :href="recipe.sourceUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    >{{ recipe.source }}</a
                  ><span v-else>{{ recipe.source }}</span>
                  <template v-if="recipe.license">
                    · {{ recipe.license }}</template
                  >
                </p>
                <small v-if="recipe.imageAttribution"
                  >Фото: {{ recipe.imageAttribution }}</small
                >
              </details>
            </section>
          </div>
        </template>
      </RecipeDining>
      <AppModal
        v-if="foundProductsOpen"
        class="found-products-modal"
        :title="`Продукты · ${priceStoreName}`"
        @close="closeFoundProducts"
      >
        <div class="found-products-body">
          <p class="found-products-context muted">
            {{ quantityLabel(servings, "порция", "порции", "порций") }} · целые
            упаковки
          </p>
          <ul class="found-products-list">
            <li v-for="row in estimate.items" :key="row.productId">
              <div class="found-product-image">
                <img
                  v-if="
                    row.product?.image &&
                    !failedProductImages.has(row.productId)
                  "
                  :src="row.product.image"
                  :class="{
                    'is-loading': !loadedProductImages.has(row.productId),
                  }"
                  @load="loadedProductImages.add(row.productId)"
                  alt=""
                  loading="lazy"
                  @error="failedProductImages.add(row.productId)"
                />
                <AppIcon
                  v-if="
                    !row.product?.image ||
                    failedProductImages.has(row.productId) ||
                    !loadedProductImages.has(row.productId)
                  "
                  name="ShoppingBasket"
                  :size="24"
                />
              </div>
              <div class="found-product-info">
                <strong>{{ row.product?.name }}</strong>
                <small
                  >{{ row.product?.unit }}{{ row.product?.unit ? " · " : ""
                  }}{{ row.quantity }} уп. ×
                  {{ money(row.product?.price || 0) }} BYN</small
                >
              </div>
              <strong class="found-product-price"
                >{{
                  money((row.product?.price || 0) * row.quantity)
                }}
                BYN</strong
              >
            </li>
          </ul>
          <p v-if="estimate.missing.length" class="found-products-missing">
            Не найдены: {{ estimate.missing.join(", ") }}. В сумму не включены.
          </p>
          <p v-if="items.length" class="muted found-products-context">
            Добавим к товарам, которые уже есть в корзине.
          </p>
        </div>
        <template #footer>
          <div class="found-products-footer">
            <p
              v-if="localError || resolveError"
              class="drawer-error"
              role="alert"
            >
              {{ localError || resolveError }}
            </p>
            <div class="found-products-total">
              <span
                >{{ estimate.complete ? "Итого" : "За найденные товары"
                }}<small>Без доставки</small></span
              >
              <div class="found-products-amount">
                <strong>{{ money(estimate.total) }} BYN</strong>
                <small v-if="estimate.complete"
                  >≈ {{ money(estimate.total / servings) }} BYN / порция ·
                  {{
                    quantityLabel(servings, "порция", "порции", "порций")
                  }}</small
                >
              </div>
            </div>
            <button
              class="primary"
              :disabled="resolving || priceLoading || !estimate.items.length"
              @click="build"
            >
              <span v-if="resolving" class="spinner" />
              {{ resolving ? "Добавляем…" : "Добавить товары в корзину" }}
              <AppIcon v-if="!resolving" name="ArrowRight" :size="18" />
            </button>
          </div>
        </template>
      </AppModal>
      <AppModal
        v-if="ingredientsOpen"
        title="Продукты для корзины"
        variant="drawer"
        @close="closeIngredients"
      >
        <div class="ingredients-drawer-body">
          <label class="drawer-store"
            >Магазин
            <select
              v-model="priceStore"
              :disabled="resolving"
              aria-label="Магазин для сборки корзины"
            >
              <option
                v-for="store in retailStores"
                :key="store.id"
                :value="store.id"
              >
                {{ store.name }}
              </option>
            </select>
          </label>
          <section class="recipe-ingredients">
            <div class="section-head">
              <h2>Ингредиенты</h2>
              <div class="serving-control">
                <button
                  aria-label="Уменьшить порции"
                  :disabled="servings <= 1 || resolving"
                  @click="servings--"
                >
                  <AppIcon name="Minus" :size="18" /></button
                ><output aria-live="polite">{{ servings }} порц.</output
                ><button
                  aria-label="Увеличить порции"
                  :disabled="servings >= 30 || resolving"
                  @click="servings++"
                >
                  <AppIcon name="Plus" :size="18" />
                </button>
              </div>
            </div>
            <p class="muted ingredient-help">
              Отметьте продукты, которые уже есть дома.
            </p>
            <div
              v-for="group in [
                { title: 'Основные', rows: main },
                { title: 'Проверьте, есть ли дома', rows: pantry },
              ]"
              :key="group.title"
              class="ingredient-group"
            >
              <h3 v-if="group.rows.length">{{ group.title }}</h3>
              <div
                v-for="row in group.rows"
                :key="row.key"
                class="ingredient-line"
                :class="{ excluded: excluded.includes(row.key) }"
              >
                <div>
                  <strong>{{ row.i.name }}</strong
                  ><span>{{ ingredientAmount(row.i) }}</span
                  ><small v-if="row.i.optional">По желанию</small>
                </div>
                <label class="checkbox"
                  ><input
                    v-model="excluded"
                    type="checkbox"
                    :value="row.key"
                    :disabled="resolving"
                  />{{
                    row.entry?.pantry ? "У меня уже есть" : "Не покупать"
                  }}</label
                >
              </div>
            </div>
          </section>
          <p v-if="items.length" class="muted basket-context">
            В корзине уже есть товары. Добавим продукты этого блюда к ним.
          </p>
          <p class="muted purchase-help">
            В корзине можно сравнить магазины. Покупаем целые упаковки; для
            ложек и «по вкусу» подберём одну. Количество можно изменить.
          </p>
        </div>
        <template #footer>
          <div class="ingredients-drawer-footer">
            <p class="drawer-price" aria-live="polite">
              <span>{{
                retailStores.find((store) => store.id === priceStore)?.name
              }}</span
              ><strong>{{
                priceLoading
                  ? "Считаем…"
                  : estimate.items.length
                    ? `${!estimate.complete ? "от " : ""}${money(estimate.total)} BYN`
                    : "Нет найденных товаров"
              }}</strong>
            </p>
            <p
              v-if="localError || resolveError"
              class="drawer-error"
              role="alert"
            >
              {{ localError || resolveError }}
            </p>
            <div class="recipe-purchase">
              <div>
                <strong
                  >{{
                    quantityLabel(
                      request?.items.length || 0,
                      "продукт",
                      "продукта",
                      "продуктов",
                    )
                  }}
                  к покупке</strong
                ><small
                  ><span v-if="!priceLoading && !estimate.complete"
                    >Найдено {{ estimate.matched }} из
                    {{ estimate.requested }}</span
                  ><span v-else-if="excluded.length"
                    >{{ excluded.length }} не покупаем</span
                  ></small
                >
              </div>
              <button
                class="primary"
                :disabled="resolving || priceLoading || !estimate.items.length"
                @click="build"
              >
                {{
                  resolving || priceLoading
                    ? "Подбираем товары…"
                    : items.length
                      ? "Добавить ингредиенты"
                      : "Добавить ингредиенты в корзину"
                }}<AppIcon
                  v-if="!resolving"
                  name="ArrowRight"
                  :size="18"
                /></button
              ><button
                v-if="resolving"
                class="text-button"
                @click="controller?.abort()"
              >
                Отменить
              </button>
            </div>
          </div>
        </template>
      </AppModal>
      <AppFeedback
        v-if="localError || resolveError"
        :message="localError || resolveError"
      />
    </template>
  </div>
</template>

<style scoped>
.found-products-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 0 0;
  font-size: 12px;
}
.found-products-modal[open] {
  width: min(690px, calc(100vw - 24px));
  height: fit-content;
  border: 1px solid var(--line);
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
}
.found-products-modal :deep(.modal-head) {
  position: static;
  flex-shrink: 0;
  padding: 16px 20px;
  margin: 0;
  border-bottom: 1px solid var(--line);
}
.found-products-modal :deep(.modal-head h2) {
  font-size: 20px;
}
.found-products-body {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 20px;
}
.found-products-context {
  font-size: 12px;
  margin: 12px 0;
}
.found-products-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.found-products-list li {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
}
.found-product-image {
  background: var(--surface);
  border-radius: 8px;
  width: 52px;
  height: 60px;
  display: grid;
  place-items: center;
  color: var(--muted);
}
.found-product-image > * {
  grid-area: 1 / 1;
}
.found-product-image img.is-loading {
  opacity: 0;
}
.found-product-image img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.found-product-info {
  min-width: 0;
  overflow-wrap: anywhere;
}
.found-product-info strong {
  font-size: 14px;
  line-height: 1.4;
  display: block;
}
.found-product-info small {
  display: block;
  font-size: 12px;
  margin-top: 4px;
}
.found-product-price {
  font-size: 14px;
  white-space: nowrap;
}
.found-products-missing {
  font-size: 12px;
  color: var(--muted);
}
.found-products-footer {
  flex-shrink: 0;
  padding: 16px 20px;
  border-top: 1px solid var(--line);
  background: white;
}
.found-products-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.found-products-total span {
  font-size: 14px;
}
.found-products-total small {
  display: block;
  margin-top: 2px;
}
.found-products-total strong {
  font-size: 22px;
}
.found-products-footer .primary {
  width: 100%;
}
@media (max-width: 600px) {
  .found-products-list li {
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 8px 12px;
  }
  .found-product-image {
    width: 44px;
    height: 52px;
    grid-row: span 2;
  }
  .found-product-price {
    grid-column: 2;
  }
  .found-product-info strong {
    font-size: 13px;
  }
  .found-products-body {
    padding: 0 16px;
  }
  .found-products-footer {
    padding: 12px 16px;
  }
}
.recipe-detail {
  padding-bottom: 24px;
}
.recipe-detail-hero {
  grid-template-columns: minmax(0, 1fr) minmax(0, 0.9fr);
  gap: 48px;
  align-items: center;
  margin-bottom: 32px;
}
.recipe-cover {
  grid-column: 2;
  grid-row: 1;
  position: relative;
  aspect-ratio: 4 / 3;
  border-radius: 20px;
}
.recipe-cover img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.recipe-intro {
  grid-column: 1;
  grid-row: 1;
  min-width: 0;
}
.recipe-detail-hero h1 {
  font-size: 42px;
  line-height: 1.15;
  margin: 0 0 14px;
}
.recipe-detail-hero p {
  font-size: 15px;
  line-height: 1.6;
  margin: 0;
}
.recipe-facts {
  margin: 18px 0;
  gap: 18px;
  font-size: 13px;
}
.recipe-intro :deep(.recipe-nutrition) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 24px;
}
.recipe-intro :deep(.recipe-energy) {
  display: flex;
  flex-direction: column;
  align-items: start;
  gap: 3px;
}
.recipe-intro :deep(.recipe-macros) {
  display: flex;
  gap: 20px;
  margin: 0;
}
.recipe-intro :deep(.recipe-macros dd) {
  font-size: 14px;
}
.recipe-intro :deep(.recipe-energy strong) {
  font-size: 18px;
}
.recipe-detail-hero .nutrition-caption {
  margin-top: 12px;
  font-size: 11px;
  line-height: 1.45;
}
h2 {
  margin: 0;
  font-size: 22px;
}
.cook-summary-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.cook-summary-head h2 {
  min-width: 0;
}
.price-store-label {
  display: block;
  flex-shrink: 0;
  margin: 0;
}
.price-store-label select {
  min-height: 24px;
  height: 24px;
  font: inherit;
  font-size: 12px;
  color: var(--muted);
  border: 0;
  background: transparent;
  padding: 0 20px 0 0;
  max-width: 100%;
  cursor: pointer;
}
.price-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  min-height: 24px;
}
.price-loading .spinner {
  width: 14px;
  height: 14px;
}
.price-caption {
  margin: 0;
  font-size: 11px;
  line-height: 1.5;
}
.price-retry {
  font-size: 12px;
  padding: 4px 0 0;
}
.cook-price-row {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin: 6px 0 4px;
}
.cook-price-row .cook-price {
  margin: 0;
  white-space: nowrap;
}
.portion-price {
  font-size: 18px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--ink);
  white-space: nowrap;
}
.found-products-amount {
  min-width: 0;
  text-align: right;
}
.found-products-amount small {
  display: block;
  margin-top: 4px;
  color: var(--ink);
  font-size: 14px;
  font-weight: 700;
  line-height: 1.5;
}
.cook-price {
  display: block;
  font-size: 18px;
  line-height: 1.2;
  color: var(--ink);
  margin: 6px 0 4px;
}
.cook-price + p {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
}
.recipe-body {
  display: grid;
  grid-template-columns: minmax(240px, 0.65fr) minmax(0, 1fr);
  gap: 56px;
  align-items: start;
}
.recipe-shopping {
  min-width: 0;
}
.recipe-ingredients {
  margin: 0;
}
.section-head {
  align-items: center;
  margin: 0 0 10px;
  gap: 12px;
}
.section-head h2 {
  font-size: 22px;
}
.serving-control {
  gap: 4px;
}
.serving-control button {
  width: 40px;
  height: 40px;
}
.serving-control output {
  font-size: 13px;
  white-space: nowrap;
}
.ingredient-help {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
}
.ingredient-group {
  margin: 20px 0;
}
.ingredient-group h3 {
  font-size: 13px;
  font-weight: 500;
  color: var(--muted);
  margin: 0 0 4px;
}
.ingredient-line {
  padding: 12px 0;
  flex-wrap: nowrap;
  gap: 12px;
  align-items: center;
}
.ingredient-line > div {
  min-width: 0;
}
.ingredient-line strong {
  font-size: 14px;
  font-weight: 500;
  overflow-wrap: anywhere;
}
.ingredient-line span,
.ingredient-line small {
  font-size: 12px;
}
.ingredient-line .checkbox {
  font-size: 11px;
  flex-shrink: 0;
  gap: 6px;
}
.recipe-purchase {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
}
.recipe-purchase > div {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
}
.recipe-purchase strong {
  font-size: 14px;
}
.recipe-purchase small {
  font-size: 12px;
  color: var(--muted);
}
.recipe-purchase .primary {
  width: 100%;
  min-height: 48px;
  justify-content: center;
  font-size: 14px;
}
.recipe-instructions {
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
  font-size: 15px;
  line-height: 1.7;
}
.recipe-instructions h2 {
  margin-bottom: 24px;
}
.recipe-instructions ol {
  padding: 0;
  list-style: none;
  counter-reset: steps;
  margin: 0;
}
.recipe-instructions li {
  counter-increment: steps;
  position: relative;
  padding: 3px 0 24px 48px;
  margin: 0;
  line-height: 1.65;
  overflow-wrap: anywhere;
}
.recipe-instructions li::before {
  content: counter(steps);
  position: absolute;
  left: 0;
  top: 0;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--brand-soft);
  color: var(--ink);
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
}
.recipe-instructions li:not(:last-child)::after {
  content: "";
  position: absolute;
  left: 15.5px;
  top: 38px;
  bottom: 6px;
  width: 1px;
  background: var(--line);
}
.recipe-instructions li:last-child {
  padding-bottom: 0;
}
.recipe-source {
  margin-top: 24px;
  color: var(--muted);
  font-size: 12px;
}
.recipe-source summary {
  cursor: pointer;
}
.basket-context,
.purchase-help {
  font-size: 12px;
  line-height: 1.5;
  color: var(--muted);
  margin: 12px 0 0;
}
.recipe-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 24px;
}
.recipe-actions .primary {
  min-height: 48px;
  font-size: 14px;
}
.recipe-steps-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--ink);
  font-size: 14px;
  text-decoration: none;
}
.recipe-steps-link:hover {
  text-decoration: underline;
}
#recipe-steps-title {
  scroll-margin-top: 100px;
}
.composition-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.composition-head .text-button {
  padding: 0;
  font-size: 13px;
}
.composition-servings {
  font-size: 12px;
  margin: 6px 0 16px;
}
.composition-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.composition-list li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: 6px 0;
  font-size: 14px;
  line-height: 1.5;
}
.composition-list li > span:first-child {
  min-width: 0;
  overflow-wrap: anywhere;
}
.composition-list li > span:last-child {
  flex-shrink: 0;
  font-size: 12px;
}
.composition-list small {
  color: var(--muted);
  font-size: 11px;
}
.composition-action {
  margin-top: 18px;
  padding: 12px 16px;
  font-size: 13px;
}
.drawer-store {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  font-size: 14px;
}
.drawer-store select {
  font: inherit;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: white;
}
.drawer-price {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  margin: 0 0 12px;
}
.drawer-price strong {
  font-size: 20px;
}
.drawer-error {
  color: var(--danger);
  font-size: 12px;
  margin: 0 0 12px;
}
.ingredients-drawer-body {
  overflow-y: auto;
  overscroll-behavior: contain;
  min-height: 0;
  flex: 1;
  padding: 20px;
}
.ingredients-drawer-body .section-head h2 {
  font-size: 17px;
}
.ingredients-drawer-footer {
  flex-shrink: 0;
  padding: 16px 20px max(16px, env(safe-area-inset-bottom));
  border-top: 1px solid var(--line);
  background: white;
}
@media (max-width: 700px) {
  .recipe-actions {
    gap: 14px;
    margin-top: 18px;
  }
  .recipe-actions .primary {
    flex: 1;
    justify-content: center;
  }
  .recipe-steps-link {
    font-size: 12px;
  }
  .composition-action {
    width: 100%;
    justify-content: center;
  }
}
@media (max-width: 900px) {
  .recipe-detail-hero {
    gap: 28px;
  }
  .recipe-body {
    grid-template-columns: minmax(0, 0.85fr) minmax(0, 1fr);
    gap: 32px;
  }
}
@media (max-width: 700px) {
  .recipe-detail-hero {
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
    margin-bottom: 24px;
  }
  .recipe-intro {
    grid-column: 1;
    grid-row: 1;
  }
  .recipe-cover {
    grid-column: 1;
    grid-row: 2;
    aspect-ratio: 16 / 9;
    max-height: 220px;
    border-radius: 16px;
  }
  .recipe-detail-hero h1 {
    font-size: 30px;
    margin-bottom: 10px;
  }
  .recipe-detail-hero p {
    font-size: 14px;
    line-height: 1.5;
  }
  .recipe-facts {
    margin: 12px 0;
  }
  .recipe-intro :deep(.recipe-nutrition) {
    gap: 12px 20px;
  }
  .recipe-intro :deep(.recipe-macros) {
    gap: 16px;
  }
  .recipe-intro :deep(.recipe-energy strong) {
    font-size: 16px;
  }
  .recipe-detail-hero .nutrition-caption {
    font-size: 10px;
    margin-top: 8px;
  }
  .cook-price {
    font-size: 18px;
  }
  .cook-price + p {
    font-size: 11px;
  }
  .recipe-body {
    grid-template-columns: minmax(0, 1fr);
    gap: 32px;
  }
  .recipe-instructions {
    border-top: 1px solid var(--line);
    padding-top: 24px;
    font-size: 15px;
  }
  .recipe-instructions h2 {
    margin-bottom: 20px;
  }
  .recipe-instructions li {
    padding-left: 44px;
    padding-bottom: 20px;
    margin: 0;
  }
  .ingredient-line .checkbox {
    font-size: 12px;
  }
  .recipe-purchase .primary {
    min-height: 48px;
  }
}
@media (max-width: 700px) {
  .cook-summary-head {
    gap: 6px;
    min-height: 24px;
  }
  .price-store-label select {
    font-size: 11px;
    max-width: 72px;
    padding-right: 12px;
  }
}
</style>
