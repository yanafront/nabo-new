<script setup lang="ts">
import type { Recipe, Ingredient } from "~/shared/recipe/model";
import { ingredientAmount } from "~/shared/recipe/model";
import { ingredientTopic } from "~/shared/seo/topics";
import type { DiningResult } from "~/shared/dining/delivio";
const route = useRoute(),
  slug = String(route.params.slug);
interface Comparison {
  recipe: Recipe;
  ingredients: Ingredient[];
  home: {
    total: number;
    perServing: number;
    checkedAt: string;
    pantryExcluded: number;
  } | null;
  dining: DiningResult | null;
  location: { label: string };
}
const { data, error } = await useAsyncData(`cook-order:${slug}`, () =>
  $fetch<Comparison>(`/api/cook-or-order/${encodeURIComponent(slug)}`),
);
if (error.value || !data.value)
  throw createError({
    statusCode: error.value?.statusCode === 404 ? 404 : 503,
    statusMessage: "Сравнение недоступно",
  });
const recipe = computed(() => data.value!.recipe);
const ready = computed(
  () => data.value?.dining?.offers.filter((o) => o.available) || [],
);
const readyMin = computed(() =>
  ready.value.length ? Math.min(...ready.value.map((o) => o.price)) : null,
);
const checked = (date: string) =>
  new Date(date).toLocaleString("ru-BY", {
    timeZone: "Europe/Minsk",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
usePageSeo(() => ({
  title: `${recipe.value.title}: приготовить дома или заказать? | Nabo`,
  description: `${recipe.value.title}: ингредиенты на ${recipe.value.servings} порции, время приготовления и предложения готового блюда. Сопоставьте продукты из магазина и заказ еды.`,
  image: recipe.value.image,
}));
</script>
<template>
  <div class="inner-page cook-order-page">
    <SeoBreadcrumbs
      :entries="[
        { name: 'Главная', path: '/' },
        { name: 'Приготовить или заказать', path: '/cook-or-order' },
        { name: recipe.title, path: `/cook-or-order/${recipe.slug}` },
      ]"
    />
    <h1>{{ recipe.title }}: приготовить дома или заказать?</h1>
    <p class="muted seo-intro">
      {{ data!.location.label }}. Условия и наличие зависят от точного адреса.
      Сравнение целых упаковок продуктов и предложений из меню; стоимость
      доставки в расчёт не включена.
    </p>
    <div class="cook-order-options">
      <section>
        <h2>Приготовить дома</h2>
        <p class="cook-order-price" v-if="data!.home">
          {{ money(data!.home.total) }} BYN <span>за продукты</span>
        </p>
        <p class="muted" v-else>
          Стоимость продуктов пока не получена. Актуальный подбор доступен на
          странице рецепта.
        </p>
        <p v-if="data!.home">
          <strong>{{ money(data!.home.perServing) }} BYN / порция</strong>
        </p>
        <p>
          {{ recipe.servings }} порции<span v-if="recipe.cookingTime">
            · {{ recipe.cookingTime }} мин приготовления</span
          >
        </p>
        <template v-if="data!.home"
          ><p class="muted">
            Евроопт · целые упаковки<span v-if="data!.home.pantryExcluded">
              · базовые продукты из домашнего запаса не покупаем</span
            >.
          </p>
          <small class="muted"
            >Проверено {{ checked(data!.home.checkedAt) }}</small
          ></template
        ><NuxtLink class="primary" :to="`/recipes/${recipe.slug}`"
          >Рецепт и продукты для корзины<AppIcon name="ArrowRight" :size="16"
        /></NuxtLink>
      </section>
      <section>
        <h2>Заказать готовое</h2>
        <p class="cook-order-price" v-if="readyMin !== null">
          от {{ money(readyMin) }} BYN <span>за блюдо из меню</span>
        </p>
        <p class="muted" v-else>
          Доступные предложения готового блюда пока не получены.
        </p>
        <p>
          Размер порции указан у предложения. Сроки, стоимость доставки и
          возможность заказа уточняйте у заведения.
        </p>
        <a
          v-if="data!.dining"
          :href="data!.dining.searchUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="secondary"
          >Открыть предложения Delivio<AppIcon name="ExternalLink" :size="16"
        /></a>
      </section>
    </div>
    <p v-if="data!.home && readyMin !== null" class="seo-intro">
      Продукты в расчёте на порцию — {{ money(data!.home.perServing) }} BYN,
      готовые предложения — от {{ money(readyMin) }} BYN. Упаковки могут
      остаться для следующего приготовления; размеры порций в меню отличаются.
      Учитывайте своё время и доставку.
    </p>
    <section class="seo-section">
      <h2>Что нужно для приготовления</h2>
      <ul class="cook-order-ingredients">
        <li v-for="(ingredient, index) in recipe.ingredients" :key="index">
          <NuxtLink
            v-if="ingredientTopic(ingredient.name)"
            :to="`/products/${ingredientTopic(ingredient.name)!.slug}`"
            >{{ ingredient.name }}</NuxtLink
          ><span v-else>{{ ingredient.name }}</span
          ><span>{{ ingredientAmount(ingredient) }}</span>
        </li>
      </ul>
    </section>
    <section v-if="ready.length" class="seo-section">
      <h2>Готовые предложения</h2>
      <div class="cook-order-offers">
        <a
          v-for="offer in ready.slice(0, 6)"
          :key="offer.id"
          :href="offer.url"
          target="_blank"
          rel="noopener noreferrer"
          ><ProductImage :src="offer.image" :alt="offer.name" />
          <div>
            <h3>{{ offer.name }}</h3>
            <p>
              {{ offer.restaurant
              }}<span v-if="offer.portion"> · {{ offer.portion }}</span>
            </p>
            <strong>{{ money(offer.price) }} BYN</strong>
          </div>
          <AppIcon name="ExternalLink" :size="16"
        /></a>
      </div>
    </section>
    <nav class="seo-links" aria-label="Связанные разделы">
      <NuxtLink :to="`/recipes/${recipe.slug}`">Пошаговый рецепт</NuxtLink
      ><NuxtLink to="/stores">Магазины продуктов</NuxtLink
      ><NuxtLink to="/delivery">Готовая еда с доставкой</NuxtLink>
    </nav>
  </div>
</template>
<style scoped>
.cook-order-page h1 {
  max-width: 950px;
}
.cook-order-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 28px;
  margin: 24px 0;
}
.cook-order-options section {
  min-width: 0;
  border-top: 1px solid var(--line);
  padding-top: 18px;
}
.cook-order-options h2 {
  font-size: 22px;
}
.cook-order-options p {
  margin: 12px 0;
  line-height: 1.5;
}
.cook-order-options .primary,
.cook-order-options .secondary {
  margin-top: 16px;
}
.cook-order-price {
  font-size: 30px;
  font-weight: 700;
}
.cook-order-price span {
  display: block;
  font-size: 13px;
  font-weight: 400;
  color: var(--muted);
}
.cook-order-ingredients {
  list-style: none;
  max-width: 650px;
  padding: 0;
}
.cook-order-ingredients li {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}
.cook-order-ingredients a {
  color: var(--blue);
}
.cook-order-offers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.cook-order-offers > a {
  display: grid;
  grid-template-columns: 64px 1fr 16px;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
  min-width: 0;
}
.cook-order-offers :deep(.product-image) {
  width: 64px;
  height: 64px;
}
.cook-order-offers h3 {
  font-size: 15px;
  margin: 0;
}
.cook-order-offers p {
  font-size: 12px;
  color: var(--muted);
  margin: 6px 0;
}
@media (max-width: 650px) {
  .cook-order-options,
  .cook-order-offers {
    grid-template-columns: 1fr;
    gap: 18px;
  }
  .cook-order-page h1 {
    font-size: 28px;
  }
  .cook-order-price {
    font-size: 27px;
  }
}
</style>
