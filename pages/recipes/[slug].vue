<script setup lang="ts">
import {
  perServing,
  scaledIngredients,
  ingredientAmount,
  type Recipe,
  type Ingredient,
} from "~/shared/recipe/model";
import { recipePurchaseRequest } from "~/shared/recipe/purchasing";
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
async function build() {
  localError.value = "";
  if (!request.value) return;
  controller = new AbortController();
  if (await resolve(request.value, controller.signal, items.value.length > 0))
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
          <RecipeNutrition v-if="nutrition" :nutrition="nutrition" />
          <p class="muted nutrition-caption">
            {{
              nutrition
                ? "Значения могут отличаться в зависимости от выбранных продуктов."
                : "Для этого рецепта пищевая ценность пока не указана."
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
