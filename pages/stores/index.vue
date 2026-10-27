<script setup lang="ts">
import { retailStores } from "~/shared/yandex";
import { jsonLd, PRIMARY_SITE_ORIGIN } from "~/shared/seo/core";
const { location } = useRetail();
useHead(() => ({
  script: [
    {
      key: "store-catalog-schema",
      type: "application/ld+json",
      innerHTML: jsonLd({
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Продуктовые магазины Беларуси",
        itemListElement: retailStores.map((store, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: store.name,
          url: `${PRIMARY_SITE_ORIGIN}/stores/${store.id}`,
        })),
      }),
    },
  ],
}));
</script>

<template>
  <div class="inner-page stores-page">
    <SeoBreadcrumbs
      :entries="[
        { name: 'Главная', path: '/' },
        { name: 'Магазины', path: '/stores' },
      ]"
    />
    <div class="page-heading stores-heading">
      <div>
        <h1>Продуктовые магазины</h1>
        <p class="muted">
          Откройте каталог для поиска продуктов или найдите магазины рядом на
          карте.
        </p>
      </div>
    </div>
    <p class="stores-map-context muted">
      Поиск на карте — рядом с точкой «{{ location.label }}». Чтобы выбрать
      другой адрес, нажмите на местоположение вверху страницы.
    </p>
    <div class="store-catalog-grid">
      <article
        v-for="store in retailStores"
        :key="store.id"
        class="store-entry"
      >
        <NuxtLink
          :to="`/stores/${store.id}`"
          class="store-catalog-card"
          :aria-label="`${store.name}: поиск продуктов и каталог товаров`"
        >
          <div>
            <h2><StoreBrand :store-id="store.id" size="large" /></h2>
          </div>
          <AppIcon name="ArrowRight" :size="20" />
        </NuxtLink>
        <NearbyStoresLink :store-id="store.id" />
      </article>
    </div>
    <section class="seo-section" aria-labelledby="stores-nearby-title">
      <h2 id="stores-nearby-title">Как найти продуктовый магазин рядом</h2>
      <p class="muted">
        Ссылка «Магазины рядом» откроет поиск выбранной сети на Яндекс Картах.
        На карте можно посмотреть адреса, часы работы и построить маршрут. Nabo
        передаёт выбранную точку как центр поиска, а не подтверждение вашего
        местоположения.
      </p>
      <details>
        <summary>Как купить продукты онлайн?</summary>
        <p>
          Откройте каталог сети или общий поиск продуктов, выберите товары и
          соберите корзину. Сравнение покажет предложения магазинов. Покупка и
          доставка оформляются на сайте сети; цены онлайн могут отличаться от
          цен в торговом зале.
        </p>
      </details>
      <nav class="seo-links" aria-label="Покупка продуктов">
        <NuxtLink to="/products"
          >Поиск товаров и сравнение цен на продукты</NuxtLink
        >
        <NuxtLink to="/recipes"
          >Что приготовить: рецепты и ингредиенты</NuxtLink
        >
      </nav>
    </section>
  </div>
</template>

<style scoped>
.stores-map-context {
  font-size: 13px;
  margin-bottom: 20px;
}
.store-entry {
  min-width: 0;
}
.store-entry > .nearby-stores-link {
  margin: 10px 12px 4px;
}
</style>
