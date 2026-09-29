<script setup lang="ts">
import type { Recipe } from "~/shared/recipe/model";
const { data: ideas } = await useAsyncData("home-recipe-ideas", () =>
  $fetch<{ recipes: Recipe[] }>("/api/recipes", { query: { limit: 3 } }),
);
import { retailStores } from "~/shared/yandex";
const { items, title } = useBasket();
</script>
<template>
  <div class="home">
    <section class="home-start">
      <div class="home-hero">
        <div class="hero-copy">
          <div class="eyebrow">МЕНЬШЕ ПОИСКОВ. БОЛЬШЕ ВЫГОДЫ.</div>
          <h1>Что хотите<br /><span>приготовить или купить?</span></h1>
          <p class="home-intro">
            Выберите продукты сами или начните с рецепта. Затем сравним готовую
            корзину по магазинам.
          </p>
        </div>
        <div class="hero-art" aria-hidden="true">
          <img
            src="/images/grocery-hero.webp"
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
      <nav class="intent-grid compact-intents" aria-label="Другие сценарии">
        <NuxtLink to="/recipes?collection=budget&budget=25&servings=2">
          <AppIcon name="Wallet" :size="20" />
          <span
            ><strong>Ужин до 25 BYN</strong
            ><small>На двоих, с проверкой реальных цен</small></span
          >
        </NuxtLink>
        <NuxtLink v-if="items.length" to="/recipes?add=1">
          <AppIcon name="Plus" :size="20" />
          <span
            ><strong>Добавить ещё блюдо</strong
            ><small>Объединить продукты в одной корзине</small></span
          >
        </NuxtLink>
        <NuxtLink to="/saved">
          <AppIcon name="History" :size="20" />
          <span
            ><strong>Повторить покупки</strong
            ><small>Открыть сохранённую корзину</small></span
          >
        </NuxtLink>
      </nav>
      <div class="home-shortcuts">
        <NuxtLink to="/stores"
          >Каталоги магазинов <AppIcon name="ArrowRight" :size="16"
        /></NuxtLink>
      </div>
    </section>
    <NuxtLink v-if="items.length" to="/basket" class="resume-basket"
      ><span class="resume-icon"><AppIcon name="ShoppingBasket" /></span
      ><span
        ><small>ПРОДОЛЖИТЬ ПОКУПКИ</small><strong>{{ title }}</strong
        ><span
          >В корзине:
          {{
            quantityLabel(items.length, "позиция", "позиции", "позиций")
          }}</span
        ></span
      ><AppIcon name="ArrowRight"
    /></NuxtLink>
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
            {{ store.name }}
          </li>
        </ul>
      </div>
      <NuxtLink
        :to="items.length ? '/compare' : '/products'"
        class="secondary one-basket-link"
      >
        {{ items.length ? "Сравнить корзину" : "Собрать корзину"
        }}<AppIcon name="ArrowRight" :size="18" />
      </NuxtLink>
    </section>
    <section class="inspiration">
      <div class="section-head">
        <h2>Начните с блюда</h2>
        <NuxtLink to="/recipes" class="text-button">Что приготовить</NuxtLink>
      </div>
      <div class="dish-grid">
        <RecipeCard
          v-for="recipe in ideas?.recipes || []"
          :key="recipe.id"
          :recipe="recipe"
        />
      </div>
      <NuxtLink to="/recipes" class="text-button"
        >Все рецепты <AppIcon name="ArrowRight" :size="16"
      /></NuxtLink>
    </section>
  </div>
</template>
