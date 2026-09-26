<script setup lang="ts">
import { retailStores } from "~/shared/yandex";
</script>

<template>
  <div class="inner-page stores-page">
    <div class="page-heading stores-heading">
      <div>
        <span class="eyebrow">Каталоги магазинов</span>
        <h1>Выберите магазин</h1>
        <p class="muted">
          Ищите товары, смотрите актуальные цены и сравнивайте магазины.
        </p>
      </div>
    </div>
    <div class="store-catalog-grid">
      <NuxtLink
        v-for="store in retailStores"
        :key="store.id"
        :to="`/stores/${store.id}`"
        class="store-catalog-card"
      >
        <span class="store-logo large" :style="{ background: store.color }">{{
          store.letter
        }}</span>
        <div>
          <h2>{{ store.name }}</h2>
          <p>Открыть каталог</p>
        </div>
        <AppIcon name="ArrowRight" :size="20" />
      </NuxtLink>
    </div>
    <div class="catalog-explainer">
      <AppIcon name="ScanSearch" :size="22" />
      <div>
        <strong>Сравнение в карточке товара</strong>
        <p>
          Откройте товар — покажем похожие позиции и цены остальных магазинов.
        </p>
      </div>
    </div>
  </div>
</template>
