<script setup lang="ts">
import {
  perServing,
  scaledIngredients,
  ingredientAmount,
  type Recipe,
  type Ingredient,
} from "~/shared/recipe/model";
import { recipePurchaseRequest } from "~/shared/recipe/purchasing";
import { recipeBasket } from "~/shared/recipe-basket";
import type { StoreComparison } from "~/shared/yandex";
const route = useRoute();
const slug = String(route.params.slug);
const { data, error, refresh } = await useAsyncData(`recipe:${slug}`, () =>
  $fetch<{ recipe: Recipe; ingredients: Ingredient[] }>(
    `/api/recipes/${encodeURIComponent(slug)}`,
  ),
);
const recipe = computed(() => data.value?.recipe);
const dictionary = computed(() => data.value?.ingredients || []);
const servings = ref(
  Math.min(
    30,
    Math.max(1, Number(route.query.servings) || recipe.value?.servings || 2),
  ),
);
const excluded = ref<string[]>([]);
const imageFailed = ref(false);
const { resolve, resolving, resolveError } = useRecipeBasket();
const { items } = useBasket();
const { location } = useRetail();
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
watch(servings, () => {
  quote.value = null;
});
async function build() {
  localError.value = "";
  if (!request.value) return;
  controller = new AbortController();
  if (await resolve(request.value, controller.signal, items.value.length > 0))
    await navigateTo("/basket");
}
const budget = ref(
  typeof route.query.budget === "string" ? route.query.budget : "25",
);
const checking = ref(false);
const quote = ref<{
  total: number;
  complete: boolean;
  matched: number;
  count: number;
} | null>(null);
const quoteError = ref("");
watch(
  [servings, excluded, location, budget],
  () => {
    quote.value = null;
    quoteController?.abort();
    quoteError.value = "";
  },
  { deep: true },
);
let quoteController: AbortController | undefined;
async function checkBudget() {
  if (!request.value || !request.value.items.length) return;
  checking.value = true;
  quoteError.value = "";
  quote.value = null;
  quoteController?.abort();
  const current = new AbortController();
  quoteController = current;
  const point = JSON.stringify(location.value),
    key = JSON.stringify(request.value);
  try {
    const result = await $fetch<{ offers: StoreComparison[] }>(
      "/api/yandex/compare",
      {
        method: "POST",
        body: {
          items: request.value.items.map((i) => ({
            id: i.productId,
            query: i.product!.name,
            quantity: 1,
            requirement: i.requirement,
          })),
          location: location.value,
        },
        signal: current.signal,
        timeout: 120000,
        retry: 0,
      },
    );
    if (
      current.signal.aborted ||
      point !== JSON.stringify(location.value) ||
      key !== JSON.stringify(request.value)
    )
      return;
    const b = recipeBasket(result.offers, request.value.items);
    if (!b) throw new Error();
    quote.value = {
      total: b.total,
      complete: b.missing.length === 0,
      matched: b.matched,
      count: request.value.items.length,
    };
  } catch {
    if (!current.signal.aborted)
      quoteError.value = "Не удалось проверить цены. Попробуйте ещё раз.";
  } finally {
    if (quoteController === current) checking.value = false;
  }
}
onBeforeUnmount(() => {
  controller?.abort();
  quoteController?.abort();
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
            @error="imageFailed = true"
          />
          <div v-else class="dish-placeholder">
            <AppIcon name="ShoppingBasket" :size="64" /><span
              >Соберите продукты для этого блюда</span
            >
          </div>
        </div>
        <div>
          <span class="eyebrow">ОТ РЕЦЕПТА К ПОКУПКАМ</span>
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
            }}</span
            ><span>{{
              quantityLabel(servings, "порция", "порции", "порций")
            }}</span>
          </div>
          <div v-if="nutrition" class="nutrition-panel">
            <span
              v-for="(value, key) in {
                Ккал: nutrition.calories,
                'Белки, г': nutrition.protein,
                'Жиры, г': nutrition.fat,
                'Углеводы, г': nutrition.carbs,
              }"
              :key="key"
              ><strong>{{ Math.round(value) }}</strong
              ><small>{{ key }}</small></span
            >
          </div>
          <p class="muted nutrition-caption">
            {{
              nutrition
                ? `На одну порцию · ${nutrition.calculationType === "source" ? "данные источника" : "расчёт по ингредиентам"}`
                : "Источник не передал КБЖУ. Мы не подставляем приблизительные цифры."
            }}
          </p>
        </div>
      </div>
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
        <p class="muted">
          Количество продуктов меняется вместе с порциями. В магазинах покупаем
          целые упаковки. Для количества в ложках или «по вкусу», которое нельзя
          точно пересчитать, подберём одну упаковку. Количество можно изменить в
          корзине.
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
      <section class="recipe-budget panel">
        <h2>Уложимся в бюджет?</h2>
        <p class="muted">
          Проверим стоимость целых упаковок в магазинах для
          {{ servings }} порций. Без доставки и сборов.
        </p>
        <div class="budget-input">
          <label
            >Бюджет, BYN<input
              v-model="budget"
              type="number"
              min="1"
              max="10000" /></label
          ><button
            class="secondary"
            :disabled="
              checking ||
              !request?.items.length ||
              !Number.isFinite(Number(budget)) ||
              Number(budget) <= 0
            "
            @click="checkBudget"
          >
            {{ checking ? "Проверяем цены…" : "Проверить цены" }}</button
          ><button
            v-if="checking"
            class="text-button"
            @click="
              quoteController?.abort();
              checking = false;
            "
          >
            Отменить
          </button>
        </div>
        <p v-if="request?.manual.length" class="muted">
          Не включили в автоматический подбор: {{ request.manual.join(", ") }}.
          Их можно добавить в корзину вручную после сравнения.
        </p>
        <p v-if="quoteError" role="alert" class="error">{{ quoteError }}</p>
        <p v-if="quote" role="status">
          <template v-if="quote.complete"
            ><strong>{{ money(quote.total) }} BYN за корзину</strong> ·
            {{
              quote.total <= Number(budget)
                ? "Укладывается в бюджет"
                : "Выше бюджета на " +
                  money(quote.total - Number(budget)) +
                  " BYN"
            }}.<br /><small
              >{{ money(quote.total / servings) }} BYN на порцию по стоимости
              покупок. В упаковках могут остаться продукты.</small
            ></template
          ><template v-else
            >Найдено {{ quote.matched }} из {{ quote.count }} продуктов.
            {{ money(quote.total) }} BYN — только за найденное; пока нельзя
            подтвердить бюджет.</template
          >
        </p>
      </section>
      <details class="recipe-instructions">
        <summary>Приготовление и источник</summary>
        <ol v-if="recipe.instructions?.length">
          <li v-for="(step, n) in recipe.instructions" :key="n">
            {{ step.text }}
          </li>
        </ol>
        <p v-else>Шаги приготовления не переданы источником.</p>
        <p>
          {{ recipe.source }} · {{ recipe.license }}<br /><a
            v-if="recipe.sourceUrl"
            :href="recipe.sourceUrl"
            target="_blank"
            rel="noopener noreferrer"
            >Открыть источник</a
          >
        </p>
        <small v-if="recipe.imageAttribution"
          >Фото: {{ recipe.imageAttribution }}</small
        >
      </details>
      <p v-if="items.length" class="info-note">
        В корзине уже есть товары. Добавим продукты этого блюда к ним.
      </p>
      <p v-if="localError || resolveError" class="error" role="alert">
        {{ localError || resolveError }}
      </p>
      <div class="recipe-sticky">
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
            >{{ rows.length }} ингредиентов в рецепте<span
              v-if="excluded.length"
            >
              · {{ excluded.length }} отмечено «не покупать»</span
            ></small
          >
        </div>
        <button
          class="primary"
          :disabled="resolving || !request?.items.length"
          @click="build"
        >
          {{
            resolving
              ? "Подбираем товары…"
              : items.length
                ? "Добавить ингредиенты"
                : "Добавить ингредиенты в корзину"
          }}<AppIcon v-if="!resolving" name="ArrowRight" :size="18" /></button
        ><button
          v-if="resolving"
          class="text-button"
          @click="controller?.abort()"
        >
          Отменить
        </button>
      </div>
    </template>
  </div>
</template>
