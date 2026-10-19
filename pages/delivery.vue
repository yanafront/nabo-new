<script setup lang="ts">
import { PRIMARY_SITE_ORIGIN } from "~/shared/seo/core";
import type { Recipe } from "~/shared/recipe/model";
const route = useRoute();
const origin = PRIMARY_SITE_ORIGIN;
const page = computed(() => Math.max(1, Number(route.query.page) || 1));
const failedImages = ref(new Set<string>());
const { data, error, refresh } = await useAsyncData(
  "delivery-recipes",
  () =>
    $fetch<{ recipes: Recipe[]; total: number }>("/api/recipes", {
      query: { offset: (page.value - 1) * 24, limit: 24 },
    }),
  { watch: [page] },
);
if (page.value > 1 && data.value && (page.value - 1) * 24 >= data.value.total)
  throw createError({ statusCode: 404, statusMessage: "Страница не найдена" });
function pageLink(n: number) {
  return { path: "/delivery", query: { page: n > 1 ? String(n) : undefined } };
}
usePageSeo(() => ({
  title: `Готовые блюда с доставкой${page.value > 1 ? ` — страница ${page.value}` : ""} — Nabo`,
  description:
    "Выберите блюдо, посмотрите предложения заведений в Delivio и сравните их с приготовлением дома. Цены и доставка зависят от адреса.",
  noindex: !data.value?.recipes.length,
  schemas: [
    {
      "@type": "ItemList",
      itemListElement:
        data.value?.recipes.map((r, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: origin + `/recipes/${r.slug}#recipe-ready-offers`,
        })) || [],
    },
  ],
}));
</script>
<template>
  <div class="inner-page">
    <SeoBreadcrumbs
      :entries="[
        { name: 'Главная', path: '/' },
        { name: 'Готовая еда с доставкой', path: '/delivery' },
      ]"
    />
    <div class="page-heading">
      <div>
        <h1>Готовые блюда с доставкой</h1>
        <p class="muted">
          Выберите блюдо: на странице рецепта покажем предложения заведений и
          вариант приготовления дома.
        </p>
      </div>
    </div>
    <div v-if="error" class="info-note" role="status">
      <p>Не удалось загрузить блюда. Попробуйте ещё раз.</p>
      <button class="secondary" @click="refresh()">Повторить</button>
    </div>
    <p v-else-if="!data?.recipes.length" class="muted">
      Пока нет доступных блюд.
    </p>
    <div v-else class="dish-grid">
      <NuxtLink
        v-for="(recipe, index) in data?.recipes"
        :key="recipe.slug"
        :to="`/recipes/${recipe.slug}#recipe-ready-offers`"
        class="delivery-dish"
        ><div class="delivery-photo">
          <img
            v-if="recipe.image && !failedImages.has(recipe.slug)"
            :src="recipe.image"
            :alt="recipe.title"
            :loading="index < 2 ? 'eager' : 'lazy'"
            decoding="async"
            width="400"
            height="280"
            @error="failedImages.add(recipe.slug)"
          />
          <div v-else class="delivery-placeholder" aria-hidden="true">
            <AppIcon name="Utensils" :size="32" />
          </div>
        </div>
        <h2>{{ recipe.title }}</h2>
        <span class="muted">Предложения готового блюда</span></NuxtLink
      >
    </div>
    <nav
      v-if="data?.recipes.length && !error"
      class="delivery-pagination"
      aria-label="Страницы блюд"
    >
      <NuxtLink v-if="page > 1" :to="pageLink(page - 1)">Назад</NuxtLink
      ><span>Страница {{ page }}</span
      ><NuxtLink v-if="page * 24 < (data?.total || 0)" :to="pageLink(page + 1)"
        >Дальше</NuxtLink
      >
    </nav>
  </div>
</template>
<style scoped>
.delivery-dish {
  min-width: 0;
  display: block;
}
.delivery-photo {
  height: 180px;
  border-radius: 16px;
  overflow: hidden;
  background: #f6f7f9;
}
.delivery-photo img,
.delivery-placeholder {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.delivery-placeholder {
  display: grid;
  place-items: center;
  color: var(--muted);
}
.delivery-dish h2 {
  font-size: 17px;
  margin: 12px 0 4px;
}
.delivery-dish span {
  font-size: 12px;
}
.delivery-pagination {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin: 24px 0;
}
</style>
