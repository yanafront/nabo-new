<script setup lang="ts">
useSiteSeo();
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
const { show: showToast } = useToast();
watch(offline, (value) => {
  showToast(
    value
      ? "Нет интернета. Для поиска и обновления цен нужно подключение."
      : "Подключение восстановлено",
    value ? "error" : "success",
  );
});
const updateConnection = () => {
  offline.value = !navigator.onLine;
};
onMounted(() => {
  updateConnection();
  window.addEventListener("online", updateConnection);
  window.addEventListener("offline", updateConnection);
});
watch(notice, (message) => {
  if (!message) return;
  const error = /не удалось|недоступн|ошибк|не сохран|войдите/i.test(message);
  const success =
    !error && /добавлен|сохранён|очищен|заменён|скопирован/i.test(message);
  showToast(message, error ? "error" : success ? "success" : "info");
  notice.value = "";
});
onUnmounted(() => {
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
    <main id="main"><NuxtPage /></main>
    <footer class="footer">
      <NuxtLink to="/delivery">Готовые блюда с доставкой</NuxtLink>
      <span>Цены в BYN · Покупка у магазина</span>
      <nav class="footer-documents" aria-label="Правовая информация">
        <button @click="info = true">Как работает Nabo</button>
        <NuxtLink to="/legal/terms">Пользовательское соглашение</NuxtLink>
        <NuxtLink to="/legal/privacy">Политика персональных данных</NuxtLink>
        <NuxtLink to="/legal/cookies">Cookies</NuxtLink>
        <button @click="cookieSettings = true">Настройки cookies</button>
      </nav>
      <div class="footer-mobile">
        <div class="footer-mobile-brand">
          <BrandMark /><span>Цены в BYN<br />Покупка у магазина</span>
        </div>
        <div class="footer-mobile-links">
          <button @click="info = true">
            Как работает Nabo<AppIcon name="ArrowRight" :size="15" />
          </button>
          <NuxtLink to="/delivery"
            >Готовые блюда с доставкой<AppIcon name="ArrowRight" :size="15"
          /></NuxtLink>
          <details class="footer-mobile-legal">
            <summary>
              Документы<AppIcon name="ChevronDown" :size="15" />
            </summary>
            <nav aria-label="Правовая информация">
              <NuxtLink to="/legal/terms">Пользовательское соглашение</NuxtLink>
              <NuxtLink to="/legal/privacy"
                >Политика персональных данных</NuxtLink
              >
              <NuxtLink to="/legal/cookies">Cookies</NuxtLink>
            </nav>
          </details>
        </div>
        <button class="footer-cookie-settings" @click="cookieSettings = true">
          Настройки cookies
        </button>
      </div>
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
    <ToastHost />
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

<style scoped>
.footer-mobile {
  display: none;
}
@media (max-width: 760px) {
  .footer > a,
  .footer > span,
  .footer > .footer-documents {
    display: none;
  }
  .footer {
    display: block;
    padding: 24px 0 12px;
  }
  .footer-mobile {
    display: block;
    width: 100%;
  }
  .footer-mobile-brand {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
  }
  .footer-mobile-brand :deep(.brand-mark) {
    width: 84px;
    height: 28px;
  }
  .footer-mobile-brand > span {
    font-size: 11px;
    line-height: 1.6;
    text-align: right;
    color: var(--muted);
  }
  .footer-mobile-links {
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
  }
  .footer-mobile-links > a,
  .footer-mobile-links > button,
  .footer-mobile-legal > summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    width: 100%;
    min-height: 44px;
    padding: 12px 0;
    border: 0;
    background: none;
    text-align: left;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.4;
    color: var(--ink);
    cursor: pointer;
  }
  .footer-mobile-links svg {
    flex-shrink: 0;
    color: var(--muted);
  }
  .footer-mobile-legal > summary {
    list-style: none;
  }
  .footer-mobile-legal > summary::-webkit-details-marker {
    display: none;
  }
  .footer-mobile-legal[open] > summary :deep(svg) {
    transform: rotate(180deg);
  }
  .footer-mobile-legal nav {
    display: grid;
    padding: 0 0 10px 12px;
    border-left: 2px solid var(--line);
    margin-bottom: 12px;
  }
  .footer-mobile-legal a {
    padding: 10px 0 10px 4px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--muted);
    overflow-wrap: anywhere;
  }
  .footer .footer-cookie-settings {
    display: block;
    min-height: 44px;
    padding: 12px 0;
    margin-top: 4px;
    text-align: left;
    font-size: 11px;
    color: var(--muted);
  }
}
</style>
