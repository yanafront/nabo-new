<script setup lang="ts">
import { retailStores } from "~/shared/yandex";
</script>

<template>
  <div class="inner-page stores-page">
    <div class="page-heading stores-heading">
      <div>
        <span class="eyebrow">Каталоги магазинов</span>
        <h1>Добавить из магазина</h1>
        <p class="muted">
          Знаете, что ищете? Откройте каталог и добавьте продукты в корзину.
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
        <div>
          <h2><StoreBrand :store-id="store.id" size="large" /></h2>
          <p>Открыть каталог</p>
        </div>
        <AppIcon name="ArrowRight" :size="20" />
      </NuxtLink>
    </div>
  </div>
</template>
