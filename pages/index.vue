<script setup lang="ts">
import type { Recipe } from "~/shared/recipe/model";
const inspiration = ref<HTMLElement>();
const {
  data: ideas,
  pending: ideasPending,
  error: ideasError,
  execute: loadIdeas,
} = await useAsyncData(
  "home-recipe-ideas",
  () =>
    $fetch<{ recipes: Recipe[] }>("/api/recipes", {
      query: { limit: 3 },
      timeout: 15000,
      retry: 0,
    }),
  { server: false, immediate: false, default: () => ({ recipes: [] }) },
);
let ideasObserver: IntersectionObserver | undefined;
onMounted(() => {
  if (!inspiration.value) return;
  if (!("IntersectionObserver" in window)) {
    void loadIdeas();
    return;
  }
  ideasObserver = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      ideasObserver?.disconnect();
      void loadIdeas();
    },
    { rootMargin: "240px" },
  );
  ideasObserver.observe(inspiration.value);
});
onBeforeUnmount(() => ideasObserver?.disconnect());
import { retailStores } from "~/shared/yandex";
const { items } = useBasket();
useHead({
  link: [
    {
      rel: "preload",
      as: "image",
      imagesrcset:
        "/images/grocery-hero-400.webp 400w, /images/grocery-hero-700.webp 700w, /images/grocery-hero.webp 1000w",
      imagesizes: "(max-width: 600px) 260px, (max-width: 1000px) 45vw, 550px",
      fetchpriority: "high",
    },
  ],
});
</script>
<template>
  <div class="home">
    <section class="home-start">
      <div class="home-hero">
        <div class="hero-copy">
          <h1>Что хотите<br /><span>приготовить или купить?</span></h1>
          <p class="home-intro">
            Выберите продукты сами или начните с рецепта. Затем сравним готовую
            корзину по магазинам.
          </p>
        </div>
        <div class="hero-art" aria-hidden="true">
          <img
            src="/images/grocery-hero-700.webp"
            srcset="
              /images/grocery-hero-400.webp  400w,
              /images/grocery-hero-700.webp  700w,
              /images/grocery-hero.webp     1000w
            "
            sizes="(max-width: 600px) 260px, (max-width: 1000px) 45vw, 550px"
            width="1000"
            height="667"
            alt=""
            decoding="async"
            fetchpriority="high"
          />
        </div>
      </div>
      <nav class="home-paths" aria-label="Выберите сценарий">
        <NuxtLink to="/products">
          <span class="path-icon"><AppIcon name="Search" :size="24" /></span>
          <span
            ><strong>Купить продукты</strong
            ><small
              >Найти товар сразу во всех магазинах и выбрать
              самостоятельно</small
            ></span
          >
          <AppIcon name="ArrowRight" :size="20" />
        </NuxtLink>
        <NuxtLink to="/recipes">
          <span class="path-icon"><AppIcon name="Utensils" :size="24" /></span>
          <span
            ><strong>Выбрать блюдо</strong
            ><small
              >Найти рецепт и автоматически собрать его ингредиенты</small
            ></span
          >
          <AppIcon name="ArrowRight" :size="20" />
        </NuxtLink>
      </nav>
      <nav
        v-if="items.length"
        class="intent-grid compact-intents"
        aria-label="Другие сценарии"
      >
        <NuxtLink to="/recipes?add=1">
          <AppIcon name="Plus" :size="20" />
          <span
            ><strong>Добавить ещё блюдо</strong
            ><small>Объединить продукты в одной корзине</small></span
          >
        </NuxtLink>
      </nav>
      <div class="home-shortcuts">
        <NuxtLink to="/stores"
          >Каталоги магазинов <AppIcon name="ArrowRight" :size="16"
        /></NuxtLink>
      </div>
    </section>
    <section class="home-one-basket" aria-labelledby="one-basket-title">
      <span class="one-basket-icon" aria-hidden="true"
        ><AppIcon name="ShoppingBasket" :size="26"
      /></span>
      <div class="one-basket-copy">
        <h2 id="one-basket-title">Одна корзина — все магазины</h2>
        <p>
          Соберите продукты или ингредиенты из рецептов. Nabo сравнит стоимость
          корзины и покажет, где выгоднее.
        </p>
        <ul class="one-basket-stores" aria-label="Магазины для сравнения">
          <li v-for="store in retailStores" :key="store.id">
            <StoreBrand :store-id="store.id" size="home" />
          </li>
        </ul>
      </div>
      <NuxtLink
        :to="items.length ? '/basket' : '/products'"
        class="secondary one-basket-link"
      >
        {{ items.length ? "Сравнить корзину" : "Собрать корзину"
        }}<AppIcon name="ArrowRight" :size="18" />
      </NuxtLink>
    </section>
    <section ref="inspiration" class="inspiration">
      <div class="section-head">
        <h2>Начните с блюда</h2>
        <NuxtLink to="/recipes" class="text-button">Что приготовить</NuxtLink>
      </div>
      <div v-if="ideas?.recipes.length" class="dish-grid">
        <RecipeCard
          v-for="recipe in ideas?.recipes || []"
          :key="recipe.id"
          :recipe="recipe"
        />
      </div>
      <div v-else-if="!ideasError" class="dish-grid" aria-hidden="true">
        <div v-for="n in 3" :key="n" class="home-idea-placeholder" />
      </div>
      <p v-if="ideasPending" class="sr-only" role="status">
        Загружаем рецепты…
      </p>
      <p v-if="ideasError" class="muted">
        Подборка сейчас недоступна. Рецепты можно посмотреть в каталоге.
      </p>
      <NuxtLink to="/recipes" class="text-button"
        >Все рецепты <AppIcon name="ArrowRight" :size="16"
      /></NuxtLink>
    </section>
  </div>
</template>

<style scoped>
.home-idea-placeholder {
  min-height: 280px;
  border-radius: 18px;
  background: #f6f7f9;
}
@media (max-width: 760px) {
  .home-idea-placeholder {
    min-height: 230px;
  }
}

.one-basket-stores {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
  max-width: 672px;
}
.one-basket-stores li {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  height: 48px;
  padding: 4px 8px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
}
@media (max-width: 700px) {
  .one-basket-icon {
    display: none;
  }
  .one-basket-copy {
    flex-basis: 100%;
  }
  .one-basket-stores {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    max-width: none;
  }
  .one-basket-stores li {
    padding: 4px;
  }
}
</style>
