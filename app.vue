<script setup lang="ts">
const { items, notice } = useBasket();
const { location } = useRetail();
const info = ref(false);
const showLocation = ref(false);
const offline = ref(false);
let timer: ReturnType<typeof setTimeout>;
const updateConnection = () => {
  offline.value = !navigator.onLine;
};
onMounted(() => {
  updateConnection();
  window.addEventListener("online", updateConnection);
  window.addEventListener("offline", updateConnection);
});
watch(notice, () => {
  clearTimeout(timer);
  if (notice.value) timer = setTimeout(() => (notice.value = ""), 5000);
});
onUnmounted(() => {
  clearTimeout(timer);
  window.removeEventListener("online", updateConnection);
  window.removeEventListener("offline", updateConnection);
});
</script>
<template>
  <div class="app-shell">
    <a class="skip" href="#main">К содержимому</a>
    <header class="header">
      <NuxtLink to="/" class="logo" aria-label="Nabo — главная"
        ><BrandMark /><span class="brand-tagline"
          >покупки с умом</span
        ></NuxtLink
      >
      <nav class="desktop-nav" aria-label="Основная навигация">
        <NuxtLink to="/products">Товары</NuxtLink
        ><NuxtLink to="/recipes">Рецепты</NuxtLink
        ><NuxtLink to="/basket"
          >Моя корзина
          <span v-if="items.length" class="count">{{
            items.length
          }}</span></NuxtLink
        >
      </nav>
      <button class="location" @click="showLocation = true">
        <AppIcon name="MapPin" :size="16" /><span>{{ location.label }}</span
        ><AppIcon name="ChevronDown" :size="14" />
      </button>
      <NuxtLink
        to="/account"
        class="icon-button account-link"
        aria-label="Аккаунт"
        ><AppIcon name="Users" :size="20"
      /></NuxtLink>
    </header>
    <div v-if="offline" class="offline-banner" role="status">
      Нет интернета. Корзина сохранена на устройстве. Для обновления цен нужно
      подключение.
    </div>
    <main id="main"><NuxtPage :key="$route.path" /></main>
    <footer class="footer">
      <span>Цены в BYN · Покупка у магазина</span
      ><button @click="info = true">Как работает Nabo</button>
    </footer>
    <nav class="mobile-nav" aria-label="Мобильная навигация">
      <NuxtLink to="/products"><AppIcon name="Search" />Товары</NuxtLink>
      <NuxtLink to="/recipes"><AppIcon name="Leaf" />Рецепты</NuxtLink>
      <NuxtLink to="/basket"
        ><AppIcon name="ShoppingBasket" />Корзина
        <span v-if="items.length">{{ items.length }}</span></NuxtLink
      >
    </nav>
    <div v-if="notice" class="toast" role="status">
      <AppIcon name="Check" :size="18" />{{ notice
      }}<button aria-label="Закрыть уведомление" @click="notice = ''">
        <AppIcon name="X" :size="16" />
      </button>
    </div>
    <LazyLocationPicker v-if="showLocation" @close="showLocation = false" />
    <AppModal v-if="info" title="От списка до покупки" @close="info = false">
      <ol class="how-it-works">
        <li>
          <strong>Начните с товара или рецепта</strong>
          <p>
            В поиске товаров выбираете вы. В рецепте продукты подберёт Nabo.
          </p>
        </li>
        <li>
          <strong>Проверьте корзину</strong>
          <p>Уточните количество упаковок и выберите замены.</p>
        </li>
        <li>
          <strong>Выберите магазин</strong>
          <p>
            Сравним стоимость товаров. Список можно скопировать, а покупку
            оформить у магазина.
          </p>
        </li>
      </ol>
      <div class="info-note">
        Nabo не оформляет заказ и не переносит корзину автоматически. Доставка,
        сборы и окончательные цены — у магазина. Рецепты и списки покупок
        работают без регистрации.
      </div>
    </AppModal>
  </div>
</template>
