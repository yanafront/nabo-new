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
          <RecipeNutrition v-if="nutrition" :nutrition="nutrition" compact />
          <p class="muted nutrition-caption">
            {{
              nutrition
                ? "Значения могут отличаться в зависимости от выбранных продуктов."
                : "Для этого рецепта пищевая ценность пока не указана."
            }}
          </p>
        </div>
      </div>
      <RecipeDining :title="recipe.title">
        <template #cook-summary>
          <h2>Приготовить дома</h2>
          <strong class="cook-price">Стоимость — в корзине</strong>
          <p class="muted">
            Продукты на
            {{ quantityLabel(servings, "порцию", "порции", "порций") }} · целые
            упаковки
          </p>
        </template>
        <template #cook-content>
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
          <details class="recipe-instructions">
            <summary>Приготовление и источник</summary>
            <ol v-if="recipe.instructions?.length">
              <li v-for="(step, n) in recipe.instructions" :key="n">
                {{ step.text }}
              </li>
            </ol>
            <p v-else>Шаги приготовления не переданы источником.</p>
            <p class="muted">
              Источник данных:
              <a
                v-if="recipe.sourceUrl"
                :href="recipe.sourceUrl"
                target="_blank"
                rel="noopener noreferrer"
                >{{ recipe.source }}</a
              ><span v-else>{{ recipe.source }}</span>
              <template v-if="recipe.license"> · {{ recipe.license }}</template>
            </p>
            <small v-if="recipe.imageAttribution"
              >Фото: {{ recipe.imageAttribution }}</small
            >
          </details>
          <p v-if="items.length" class="muted basket-context">
            В корзине уже есть товары. Добавим продукты этого блюда к ним.
          </p>
          <p class="muted purchase-help">
            Подберём товары и покажем цены по магазинам в корзине. Для
            количества в ложках или «по вкусу» подберём одну упаковку.
            Количество упаковок можно изменить в корзине.
          </p>
        </template>
      </RecipeDining>
      <AppFeedback
        v-if="localError || resolveError"
        :message="localError || resolveError"
      />
    </template>
  </div>
</template>

<style scoped>
.recipe-detail {
  padding-bottom: 24px;
}
.recipe-detail-hero {
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 32px;
  align-items: center;
  margin-bottom: 32px;
}
.recipe-cover {
  position: relative;
  aspect-ratio: 1;
  border-radius: 20px;
}
.recipe-cover img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.recipe-detail-hero h1 {
  font-size: 36px;
  margin: 0 0 10px;
}
.recipe-detail-hero p {
  margin: 0;
  line-height: 1.55;
}
.recipe-facts {
  margin: 14px 0;
  gap: 16px;
}
.recipe-detail-hero .nutrition-caption {
  margin-top: 10px;
  font-size: 11px;
}
h2 {
  margin: 0;
  font-size: 21px;
}
.cook-price {
  display: block;
  margin: 10px 0 6px;
  font-size: 24px;
  line-height: 1.2;
}
.cook-price + p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
}
.recipe-purchase {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}
.recipe-purchase > div {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;
}
.recipe-purchase strong {
  font-size: 14px;
}
.recipe-purchase small {
  color: var(--muted);
  font-size: 11px;
}
.recipe-purchase .primary {
  width: 100%;
  min-height: 48px;
  justify-content: center;
  font-size: 14px;
}
.recipe-ingredients {
  margin: 0;
}
.section-head {
  margin: 0 0 8px;
  align-items: center;
}
.section-head h2 {
  font-size: 19px;
}
.serving-control {
  gap: 6px;
}
.serving-control button {
  width: 36px;
  height: 36px;
}
.serving-control output {
  font-size: 13px;
}
.ingredient-help {
  margin: 0 0 16px;
  font-size: 12px;
}
.ingredient-group {
  margin: 18px 0;
}
.ingredient-group h3 {
  font-size: 14px;
  margin: 0 0 6px;
}
.ingredient-line {
  padding: 10px 0;
  flex-wrap: nowrap;
  align-items: center;
}
.ingredient-line > div {
  min-width: 0;
}
.ingredient-line strong {
  font-size: 14px;
  overflow-wrap: anywhere;
}
.ingredient-line span,
.ingredient-line small {
  font-size: 12px;
}
.ingredient-line .checkbox {
  font-size: 12px;
  flex-shrink: 0;
}
.recipe-instructions {
  border-top: 1px solid var(--line);
  padding-top: 16px;
  margin: 22px 0 14px;
  font-size: 14px;
  line-height: 1.6;
}
.recipe-instructions summary {
  font-weight: 600;
  cursor: pointer;
}
.recipe-instructions ol {
  padding-left: 20px;
}
.basket-context,
.purchase-help {
  font-size: 12px;
  line-height: 1.5;
  margin: 12px 0 0;
}
@media (max-width: 700px) {
  .recipe-detail-hero {
    grid-template-columns: 104px minmax(0, 1fr);
    gap: 16px;
    align-items: start;
    margin-bottom: 24px;
  }
  .recipe-cover {
    border-radius: 16px;
  }
  .recipe-detail-hero h1 {
    font-size: 26px;
    line-height: 1.15;
  }
  .recipe-detail-hero p {
    font-size: 13px;
  }
  .recipe-facts {
    font-size: 11px;
    gap: 8px;
    margin: 12px 0;
  }
  .recipe-detail-hero :deep(.recipe-nutrition) {
    flex-wrap: wrap;
    gap: 8px;
  }
  .recipe-detail-hero .nutrition-caption {
    font-size: 10px;
  }
  h2 {
    font-size: 17px;
  }
  .cook-price {
    font-size: 19px;
    margin-top: 8px;
  }
  .cook-price + p {
    font-size: 11px;
  }
  .recipe-purchase {
    margin-bottom: 20px;
  }
  .recipe-purchase > div {
    flex-direction: column;
    gap: 4px;
  }
  .ingredient-line strong {
    font-size: 13px;
  }
  .ingredient-line .checkbox {
    font-size: 11px;
    gap: 5px;
  }
}
@media (max-width: 360px) {
  .recipe-detail-hero {
    grid-template-columns: 80px minmax(0, 1fr);
    gap: 12px;
  }
  .cook-price {
    font-size: 17px;
  }
}
</style>
