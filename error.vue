<script setup lang="ts">
import { clearError, type NuxtError } from "#app";
const props = defineProps<{ error: NuxtError }>();
const status = computed(
  () => props.error.statusCode || props.error.status || 500,
);
const missing = computed(() => status.value === 404);
async function go(path: string) {
  try {
    await clearError({ redirect: path });
  } catch {
    window.location.assign(path);
  }
}
function retry() {
  window.location.reload();
}
useHead(() => ({
  title: missing.value
    ? "Страница не найдена · Nabo"
    : "Не удалось открыть страницу · Nabo",
  meta: [{ name: "robots", content: "noindex,nofollow" }],
}));
</script>
<template>
  <div class="nabo-error-shell">
    <a class="skip" href="#main">К содержимому</a>
    <header class="header error-header">
      <a
        href="/"
        class="logo"
        aria-label="Nabo — главная"
        @click.prevent="go('/')"
        ><BrandMark
      /></a>
      <nav aria-label="Основная навигация" class="error-nav">
        <a href="/products" @click.prevent="go('/products')">Товары</a>
        <a href="/recipes" @click.prevent="go('/recipes')">Рецепты</a>
        <a href="/basket" @click.prevent="go('/basket')">Корзина</a>
      </nav>
    </header>
    <main id="main" class="error-main">
      <section class="error-content" aria-labelledby="error-title">
        <p class="error-number" :aria-label="`Ошибка ${status}`">
          {{ status }}<span aria-hidden="true" />
        </p>
        <h1 id="error-title">
          {{ missing ? "Страница не найдена" : "Не удалось открыть страницу" }}
        </h1>
        <p class="error-description">
          {{
            missing
              ? "Возможно, ссылка устарела или в адресе есть опечатка. Продолжите с каталога товаров или рецептов."
              : "Попробуйте загрузить страницу ещё раз или вернитесь на главную."
          }}
        </p>
        <div class="error-actions">
          <template v-if="missing">
            <a href="/products" class="primary" @click.prevent="go('/products')"
              ><AppIcon name="Search" :size="18" />Найти товары</a
            >
            <a href="/recipes" class="secondary" @click.prevent="go('/recipes')"
              ><AppIcon name="Utensils" :size="18" />Выбрать рецепт</a
            >
          </template>
          <button v-else class="primary" @click="retry">
            <AppIcon name="RefreshCw" :size="18" />Повторить загрузку
          </button>
        </div>
        <a href="/" class="text-button error-home" @click.prevent="go('/')"
          ><AppIcon name="ArrowLeft" :size="16" />На главную</a
        >
      </section>
    </main>
    <footer class="error-footer">Цены в BYN · Покупка у магазина</footer>
  </div>
</template>
<style scoped>
.nabo-error-shell {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  background: #fff;
}
.error-header {
  position: static;
  justify-content: space-between;
  height: auto;
  min-height: 96px;
  width: 100%;
  max-width: 1200px;
  padding: 0 40px;
  margin: 0 auto;
}
.error-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  font-size: 14px;
}
.error-nav a:hover {
  color: var(--accent-blue);
}
.error-main {
  flex: 1;
  display: grid;
  place-items: center;
  padding: 48px 24px;
}
.error-content {
  width: 100%;
  max-width: 570px;
  text-align: center;
}
.error-number {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin: 0 0 20px;
  color: var(--ink);
  font-size: clamp(68px, 14vw, 112px);
  font-weight: 750;
  line-height: 1;
}
.error-number span {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--brand);
}
.error-content h1 {
  margin: 0 0 16px;
  font-size: clamp(26px, 5vw, 38px);
  line-height: 1.2;
}
.error-description {
  max-width: 440px;
  margin: 0 auto 28px;
  color: var(--muted);
  font-size: 15px;
  line-height: 1.65;
}
.error-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
}
.error-home {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 24px;
  font-size: 14px;
}
.error-footer {
  padding: 20px 24px;
  text-align: center;
  font-size: 12px;
  color: var(--muted);
}
.nabo-error-shell :is(a, button):focus-visible {
  outline: 2px solid var(--accent-blue);
  outline-offset: 4px;
}
@media (max-width: 480px) {
  .error-header {
    padding: 16px 20px;
    min-height: 76px;
    gap: 12px;
  }
  .error-nav {
    gap: 14px;
    font-size: 12px;
  }
  .error-header .logo {
    flex-shrink: 0;
  }
  .error-main {
    padding: 32px 20px;
  }
  .error-actions {
    flex-direction: column;
  }
  .error-actions > :is(a, button) {
    width: 100%;
  }
  .error-footer {
    padding: 16px 20px;
  }
}
</style>
