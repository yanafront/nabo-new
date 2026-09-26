<script setup lang="ts">
const { items, notice } = useBasket();
const info = ref(false);
const showLocation = ref(false);
const { location } = useRetail();
let timer: ReturnType<typeof setTimeout>;
watch(notice, () => {
  clearTimeout(timer);
  if (notice.value) timer = setTimeout(() => (notice.value = ""), 4500);
});
onUnmounted(() => clearTimeout(timer));
</script>
<template>
  <div class="app-shell">
    <a class="skip" href="#main">К содержимому</a>
    <header class="header">
      <NuxtLink to="/" class="logo" aria-label="Nabo — главная"
        ><BrandMark />nabo</NuxtLink
      >
      <nav class="desktop-nav" aria-label="Основная навигация">
        <NuxtLink to="/">Главная</NuxtLink
        ><NuxtLink to="/stores">Магазины</NuxtLink
        ><NuxtLink to="/basket"
          >Моя корзина
          <span v-if="items.length" class="count">{{
            items.length
          }}</span></NuxtLink
        ><NuxtLink to="/saved">Избранное</NuxtLink>
      </nav>
      <button class="location" @click="showLocation = true">
        <AppIcon name="MapPin" :size="17" /> {{ location.label }}
        <AppIcon name="ChevronDown" :size="14" />
      </button>
      <NuxtLink class="account-link" to="/account">Аккаунт</NuxtLink>
    </header>
    <LocationPicker v-if="showLocation" @close="showLocation = false" />
    <main id="main"><NuxtPage :key="$route.fullPath" /></main>
    <footer class="footer">
      <span>Цены в BYN · Покупка и доставка у магазина</span
      ><button @click="info = true">О сервисе</button>
    </footer>
    <nav class="mobile-nav" aria-label="Мобильная навигация">
      <NuxtLink to="/"><AppIcon name="Search" />Главная</NuxtLink
      ><NuxtLink to="/stores"><AppIcon name="Store" />Магазины</NuxtLink
      ><NuxtLink to="/basket"
        ><AppIcon name="ShoppingBasket" />Корзина
        <span v-if="items.length">{{ items.length }}</span></NuxtLink
      ><NuxtLink to="/saved"><AppIcon name="Heart" />Избранное</NuxtLink>
    </nav>
    <div v-if="notice" class="toast" role="status">
      <AppIcon name="Check" />{{ notice }}
    </div>
    <AppModal
      v-if="info"
      title="Покупки без лишних хлопот"
      @close="info = false"
      ><p>
        Расскажите, что хотите приготовить. Nabo соберёт продукты и сравнит
        стоимость товаров в шести магазинах.
      </p>
      <div class="info-note">
        Цены и наличие получаем из каталогов магазинов и Яндекс Еды. Доставка и сборы уточняются при
        оформлении; доступность витрины не гарантирует доставку по выбранному
        адресу.
      </div>
      <p>
        Своей доставки у Nabo нет. Оформление и оплата — в Яндекс Еде.
        Автоматический перенос корзины пока не подключён.
      </p></AppModal
    >
  </div>
</template>

<style scoped>
.account-link { font-size: 13px; font-weight: 600; color: #3b5bff; text-decoration: none; white-space: nowrap; }
</style>
