<script setup lang="ts">
const { items, notice } = useBasket();
const { location } = useRetail();
const route = useRoute();
const recipesActive = computed(
  () => route.path === "/recipes" || route.path.startsWith("/recipes/"),
);
const { selected: previewProduct } = useProductPreview();
const info = ref(false);
const cookieSettings = useState("cookie-settings-open", () => false);
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
        ><BrandMark
      /></NuxtLink>
      <nav class="desktop-nav" aria-label="Основная навигация">
        <NuxtLink to="/products">Товары</NuxtLink
        ><NuxtLink
          to="/recipes"
          :class="{ 'section-active': recipesActive }"
          :aria-current="
            recipesActive
              ? route.path === '/recipes'
                ? 'page'
                : 'location'
              : undefined
          "
          >Рецепты</NuxtLink
        ><NuxtLink to="/basket"
          >Моя корзина
          <span v-if="items.length" class="count">{{
            items.length
          }}</span></NuxtLink
        >
        <NuxtLink to="/saved">Сохранённое</NuxtLink>
      </nav>
      <button class="location" @click="showLocation = true">
        <AppIcon name="MapPin" :size="16" /><span>{{ location.label }}</span
        ><AppIcon name="ChevronDown" :size="14" />
      </button>
      <AccountMenu />
    </header>
    <div v-if="offline" class="offline-banner" role="status">
      Нет интернета. Корзина сохранена на устройстве. Для обновления цен нужно
      подключение.
    </div>
    <main id="main"><NuxtPage :key="$route.path" /></main>
    <footer class="footer">
      <span>Цены в BYN · Покупка у магазина</span>
      <nav class="footer-documents" aria-label="Правовая информация">
        <button @click="info = true">Как работает Nabo</button>
        <NuxtLink to="/legal/terms">Пользовательское соглашение</NuxtLink>
        <NuxtLink to="/legal/privacy">Политика персональных данных</NuxtLink>
        <NuxtLink to="/legal/cookies">Cookies</NuxtLink>
        <button @click="cookieSettings = true">Настройки cookies</button>
      </nav>
    </footer>
    <nav class="mobile-nav" aria-label="Мобильная навигация">
      <NuxtLink to="/products"><AppIcon name="Search" />Товары</NuxtLink>
      <NuxtLink
        to="/recipes"
        :class="{ 'section-active': recipesActive }"
        :aria-current="
          recipesActive
            ? route.path === '/recipes'
              ? 'page'
              : 'location'
            : undefined
        "
        ><AppIcon name="Leaf" />Рецепты</NuxtLink
      >
      <NuxtLink to="/basket"
        ><AppIcon name="ShoppingBasket" />Корзина
        <span v-if="items.length">{{ items.length }}</span></NuxtLink
      >
      <NuxtLink to="/saved"><AppIcon name="Heart" />Сохранённое</NuxtLink>
    </nav>
    <div v-if="notice" class="toast" role="status">
      <AppIcon name="Check" :size="18" />{{ notice
      }}<button aria-label="Закрыть уведомление" @click="notice = ''">
        <AppIcon name="X" :size="16" />
      </button>
    </div>
    <LazyProductPreviewModal v-if="previewProduct" />
    <CookieConsent />
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

<style scoped>
.footer {
  flex-wrap: nowrap;
}
.footer > span {
  white-space: nowrap;
}
.footer-documents {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px 16px;
  font-size: 12px;
  color: var(--muted);
}
.footer-documents a,
.footer-documents button {
  white-space: nowrap;
}
@media (max-width: 1000px) {
  .footer {
    flex-wrap: wrap;
  }
  .footer-documents {
    flex-wrap: wrap;
    justify-content: flex-start;
  }
}
.footer-documents a:hover,
.footer-documents button:hover {
  color: var(--ink);
  text-decoration: underline;
}
</style>
