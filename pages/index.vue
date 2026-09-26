<script setup lang="ts">
import { recipes } from "~/data/catalog";
import { retailStores } from "~/shared/yandex";
const composer = ref<{ submit: (q: string) => void }>();
const { items, title } = useBasket();
const picker = ref(false);
</script>
<template>
  <div class="home">
    <section class="home-start">
      <div class="eyebrow">МЕНЬШЕ ПОИСКОВ. БОЛЬШЕ ВЫГОДЫ.</div>
      <h1>Что сегодня<br /><span>в вашей корзине?</span></h1>
      <p class="home-intro">
        Напишите блюдо или продукты. Соберём корзину и найдём, где дешевле.
      </p>
      <RequestComposer ref="composer" />
      <div class="home-shortcuts">
        <button @click="picker = true">
          <AppIcon name="Plus" :size="17" /> Добавить продукты вручную</button
        ><NuxtLink to="/stores"
          >Магазины <AppIcon name="ArrowRight" :size="16"
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
    <section class="inspiration">
      <div class="section-head">
        <h2>Начните с блюда</h2>
        <span>Продукты подберём сами</span>
      </div>
      <div class="recipe-grid">
        <button
          v-for="recipe in recipes"
          :key="recipe.id"
          class="recipe-card"
          @click="composer?.submit(recipe.query)"
        >
          <img
            :src="recipe.image"
            alt=""
            loading="lazy"
            decoding="async"
          /><span class="recipe-details"
            ><strong>{{ recipe.title }}</strong
            ><small
              >{{ recipe.time }} · {{ recipe.people }}
              {{ recipe.people === 2 ? "порции" : "порций" }}</small
            ></span
          ><AppIcon name="ArrowUp" :size="18" />
        </button>
      </div>
    </section>
    <section class="store-proof" aria-label="Магазины для сравнения">
      <p>Одна корзина. Шесть магазинов.</p>
      <div>
        <span v-for="store in retailStores" :key="store.id">{{
          store.name
        }}</span>
      </div>
      <small>Сравниваем товары. Доставка и сборы уточняются у магазина.</small>
    </section>
    <LazyProductPicker v-if="picker" @close="picker = false" />
  </div>
</template>
