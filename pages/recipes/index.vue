<script setup lang="ts">
import {
  recipeCategories,
  recipeCollections,
  type Recipe,
} from "~/shared/recipe/model";
const route = useRoute();
const router = useRouter();
const query = ref(typeof route.query.q === "string" ? route.query.q : "");
const category = ref(
  !query.value && typeof route.query.category === "string"
    ? route.query.category
    : "",
);
const collection = ref(
  !query.value && !category.value && typeof route.query.collection === "string"
    ? route.query.collection
    : "",
);
const budget = ref(
  typeof route.query.budget === "string" ? route.query.budget : "25",
);
const servings = ref(
  typeof route.query.servings === "string" ? route.query.servings : "2",
);
const hasServingContext = computed(
  () => typeof route.query.servings === "string",
);
const addingToBasket = computed(() => route.query.add === "1");
const page = ref(1);
const search = ref(query.value);
let timer: ReturnType<typeof setTimeout>;
watch(query, (v) => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    search.value = v;
    if (v.trim()) {
      category.value = "";
      collection.value = "";
    }
    page.value = 1;
  }, 180);
});
watch([category, collection], () => (page.value = 1));
watch([search, category, collection], () =>
  router.replace({
    query: {
      ...(search.value ? { q: search.value } : {}),
      ...(category.value ? { category: category.value } : {}),
      ...(collection.value ? { collection: collection.value } : {}),
      ...(collection.value === "budget" ? { budget: budget.value } : {}),
      ...(hasServingContext.value ? { servings: servings.value } : {}),
      ...(addingToBasket.value ? { add: "1" } : {}),
    },
  }),
);
onBeforeUnmount(() => clearTimeout(timer));
const { data, pending, error, refresh } = await useAsyncData(
  "recipe-catalog",
  () =>
    $fetch<{ recipes: Recipe[]; total: number }>("/api/recipes", {
      query: {
        q: search.value,
        category: category.value,
        collection: collection.value,
        offset: (page.value - 1) * 24,
        limit: 24,
      },
    }),
  { watch: [search, category, collection, page] },
);
type CategorySection = {
  id: string;
  title: string;
  recipes: Recipe[];
  total: number;
};
const { data: categoryCatalog, pending: categoryCatalogPending } =
  await useAsyncData("recipe-category-catalog", () =>
    $fetch<{ sections: CategorySection[] }>("/api/recipes", {
      query: { view: "categories", limit: 3 },
    }),
  );
const browsingCatalog = computed(
  () => !search.value && !category.value && !collection.value,
);
const activeCategoryTitle = computed(
  () => recipeCategories.find((item) => item.id === category.value)?.title,
);
const recipesCount = (count: number) =>
  quantityLabel(count, "рецепт", "рецепта", "рецептов");
function chooseCategory(id: string) {
  query.value = "";
  search.value = "";
  collection.value = "";
  category.value = id;
  page.value = 1;
}
function chooseCollection(id: string) {
  query.value = "";
  search.value = "";
  category.value = "";
  collection.value = collection.value === id ? "" : id;
  page.value = 1;
}
function submitSearch() {
  search.value = query.value.trim();
  if (search.value) {
    category.value = "";
    collection.value = "";
  }
  page.value = 1;
}
function reset() {
  query.value = "";
  search.value = "";
  category.value = "";
  collection.value = "";
  page.value = 1;
}
</script>
<template>
  <div class="inner-page recipe-catalog">
    <div class="page-heading">
      <div>
        <span class="eyebrow">ИДЕЯ БЛЮДА → ВЫГОДНАЯ КОРЗИНА</span>
        <h1>Что приготовить</h1>
        <p class="muted">Выберите блюдо. Порции и покупки подстроим под вас.</p>
      </div>
    </div>
    <p v-if="addingToBasket" class="info-note">
      Выберите следующее блюдо. На его экране добавьте ингредиенты — Nabo
      объединит их с текущей корзиной.
    </p>
    <form class="recipe-search" @submit.prevent="submitSearch">
      <AppIcon name="Search" /><input
        v-model="query"
        placeholder="Что хотите приготовить?"
        aria-label="Поиск рецептов"
      /><button
        v-if="query"
        type="button"
        class="icon-button"
        aria-label="Очистить поиск"
        @click="
          query = '';
          search = '';
        "
      >
        <AppIcon name="X" /></button
      ><button class="primary">Найти</button>
    </form>
    <nav class="recipe-categories" aria-label="Категории рецептов">
      <button :aria-pressed="browsingCatalog" @click="reset">Все блюда</button
      ><button
        v-for="c in recipeCategories"
        :key="c.id"
        :aria-pressed="category === c.id"
        @click="chooseCategory(c.id)"
      >
        {{ c.title }}
      </button>
    </nav>
    <details class="recipe-more-filters" :open="Boolean(collection)">
      <summary>
        <AppIcon name="SlidersHorizontal" :size="16" /> Подборки
      </summary>
      <div class="recipe-collections" aria-label="Подборки">
        <button
          v-for="c in recipeCollections"
          :key="c.id"
          :aria-pressed="collection === c.id"
          @click="chooseCollection(c.id)"
        >
          {{ c.title }}
        </button>
      </div>
    </details>
    <p v-if="collection === 'budget'" class="info-note">
      Ищем блюдо на
      <label class="inline-number"
        ><input v-model="servings" type="number" min="1" max="30" /> чел.</label
      >
      до
      <label class="inline-number"
        ><input v-model="budget" type="number" min="1" max="10000" /> BYN</label
      >. Здесь рецепты с простым составом; точную стоимость целых упаковок
      проверим по ценам магазинов после выбора блюда.
    </p>
    <div v-if="!browsingCatalog" class="section-head recipe-results-head">
      <h2>
        {{
          activeCategoryTitle || (search ? `Поиск: «${search}»` : "Подборка")
        }}
      </h2>
      <span aria-live="polite">{{
        pending ? "Ищем рецепты…" : `Найдено: ${data?.total || 0}`
      }}</span
      ><button
        v-if="category || collection || query"
        class="text-button"
        @click="reset"
      >
        Сбросить фильтры
      </button>
    </div>
    <div v-if="browsingCatalog" class="recipe-category-catalog">
      <div
        v-if="categoryCatalogPending"
        class="dish-grid"
        aria-label="Загрузка каталога"
      >
        <div v-for="n in 6" :key="n" class="dish-skeleton skeleton" />
      </div>
      <section
        v-for="section in categoryCatalog?.sections || []"
        v-else
        :key="section.id"
        class="recipe-category-section"
      >
        <div class="section-head">
          <div>
            <h2>{{ section.title }}</h2>
            <span>{{ recipesCount(section.total) }}</span>
          </div>
          <button class="text-button" @click="chooseCategory(section.id)">
            Смотреть все <AppIcon name="ArrowRight" :size="16" />
          </button>
        </div>
        <div class="dish-grid">
          <RecipeCard
            v-for="recipe in section.recipes"
            :key="recipe.id"
            :recipe="recipe"
            :context-query="addingToBasket ? { add: 1 } : undefined"
          />
        </div>
      </section>
    </div>
    <div v-else-if="error" class="info-note" role="alert">
      Не удалось загрузить каталог.
      <button class="text-button" @click="refresh()">Повторить</button>
    </div>
    <div v-else-if="pending" class="dish-grid" aria-label="Загрузка рецептов">
      <div v-for="n in 6" :key="n" class="dish-skeleton skeleton" />
    </div>
    <div v-else-if="!data?.recipes.length" class="empty recipe-empty">
      <AppIcon name="Search" :size="36" />
      <h2>Пока нет подходящих рецептов</h2>
      <p>
        Попробуйте другое название или уберите фильтр. Подборки по питанию
        включают только рецепты с подтверждёнными КБЖУ.
      </p>
      <button class="secondary" @click="reset">Показать все блюда</button>
    </div>
    <div v-else class="dish-grid">
      <RecipeCard
        v-for="recipe in data.recipes"
        :key="recipe.id"
        :recipe="recipe"
        :context-query="
          collection === 'budget'
            ? { servings: Math.max(1, Number(servings) || 2), budget }
            : hasServingContext
              ? { servings: Math.max(1, Number(servings) || 2) }
              : addingToBasket
                ? { add: 1 }
                : undefined
        "
      />
    </div>
    <div
      v-if="!browsingCatalog && (data?.total || 0) > 24"
      class="recipe-pagination"
    >
      <button
        class="secondary"
        :disabled="page === 1 || pending"
        @click="page--"
      >
        Назад</button
      ><span>{{ page }} / {{ Math.ceil((data?.total || 0) / 24) }}</span
      ><button
        class="secondary"
        :disabled="page * 24 >= (data?.total || 0) || pending"
        @click="page++"
      >
        Дальше
      </button>
    </div>
  </div>
</template>
