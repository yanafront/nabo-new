<script setup lang="ts">
import { recipes } from "~/data/catalog";
const composer = ref<{ submit: (q: string) => void }>();
const picker = ref(false);
const category = ref<string>();
function openCategory(value?: string) {
  category.value = value;
  picker.value = true;
}
const { items } = useBasket();
function choose(q: string) {
  composer.value?.submit(q);
}
</script>
<template>
  <div class="home compact-home">
    <section class="hero home-hero">
      <div class="home-hero-content">
        <div class="home-heading">
          <span class="hero-kicker"
            ><AppIcon name="BadgeCheck" :size="15" /> Цены магазинов</span
          >
          <h1>Вся корзина дешевле — за пару минут</h1>
          <p>
            Напишите блюдо или список покупок. Nabo соберёт товары и покажет, в
            каком магазине выгоднее.
          </p>
        </div>
        <RequestComposer ref="composer" />
        <div class="hero-benefits" aria-label="Преимущества">
          <span><AppIcon name="CircleCheck" :size="15" /> 501 рецепт</span>
          <span><AppIcon name="Store" :size="15" /> 6 магазинов</span>
          <span><AppIcon name="Tag" :size="15" /> Реальные цены</span>
        </div>
      </div>
      <div class="home-hero-visual" aria-hidden="true">
        <img src="/images/nabo-grocery-hero.webp" alt="" />
        <div>
          <strong>от 32,40 BYN</strong>
          <span>корзина на ужин</span>
        </div>
      </div>
    </section>
    <section class="categories" aria-label="Добавить продукты">
      <button @click="openCategory('vegetables')">
        <img src="/images/category-produce.webp" alt="" />
        <span>Овощи и фрукты</span><AppIcon name="Plus" :size="15" />
      </button>
      <button @click="openCategory('dairy')">
        <img src="/images/category-dairy.webp" alt="" />
        <span>Молочные</span><AppIcon name="Plus" :size="15" />
      </button>
      <button @click="openCategory('bakery')">
        <img src="/images/category-bakery.webp" alt="" />
        <span>Хлеб и выпечка</span><AppIcon name="Plus" :size="15" />
      </button>
      <button @click="openCategory()">
        <span class="category-all"><AppIcon name="Search" :size="20" /></span>
        <span>Все продукты</span><AppIcon name="ArrowRight" :size="15" />
      </button>
    </section>
    <section class="inspiration">
      <div class="section-head">
        <h2>Или сразу приготовим</h2>
        <span>Продукты в один клик</span>
      </div>
      <div class="recipe-grid">
        <button
          v-for="recipe in recipes"
          :key="recipe.id"
          class="recipe-card"
          @click="choose(recipe.query)"
        >
          <div class="recipe-photo" :style="{ backgroundColor: recipe.color }">
            <img
              :src="recipe.image"
              alt=""
              @error="
                ($event.target as HTMLImageElement).src =
                  '/images/nabo-grocery-hero.webp'
              "
            />
          </div>
          <div class="recipe-details">
            <h3>{{ recipe.title }}</h3>
            <span
              >{{ recipe.time }} · {{ recipe.people }}
              {{ recipe.people === 5 ? "порций" : "порции" }}</span
            >
          </div>
          <span class="recipe-arrow"
            ><AppIcon name="ArrowRight" :size="17"
          /></span>
        </button>
      </div>
    </section>
    <NuxtLink v-if="items.length" to="/basket" class="resume-basket"
      ><AppIcon name="ShoppingBasket" :size="19" /><span
        >Ваша корзина <small>{{ items.length }} позиций</small></span
      ><AppIcon name="ArrowRight" :size="18"
    /></NuxtLink>
    <div class="store-proof">
      <span
        ><AppIcon name="ScanSearch" :size="14" /> Сравниваем полную
        корзину</span
      ><b class="euroopt">Евроопт</b><b class="green">Гиппо</b
      ><b class="sosedi">Белмаркет</b><b class="korona">Санта</b>
    </div>
    <LazyProductPicker :category="category" v-if="picker" @close="picker = false" />
  </div>
</template>
