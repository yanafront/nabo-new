<script setup lang="ts">
const { valid, open, choose } = useCookieChoice();
</script>
<template>
  <ClientOnly>
    <section
      v-if="!valid || open"
      class="cookie-consent"
      aria-label="Настройки cookies"
    >
      <div>
        <strong>Настройки cookies</strong>
        <p>
          Необходимые cookies обеспечивают вход. Аналитика Яндекс Метрики —
          только с вашего разрешения.
          <NuxtLink to="/legal/cookies">Подробнее</NuxtLink>
        </p>
      </div>
      <div class="cookie-actions">
        <button class="secondary" @click="choose(false)">
          Только необходимые</button
        ><button class="primary" @click="choose(true)">
          Разрешить аналитику
        </button>
      </div>
    </section>
  </ClientOnly>
</template>
<style scoped>
.cookie-consent {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: min(460px, calc(100vw - 40px));
  background: #fff;
  border: 1px solid var(--line);
  padding: 18px;
  border-radius: 18px;
  box-shadow: 0 8px 32px #0f0f101a;
  z-index: 150;
}
p {
  margin: 6px 0 14px;
  font-size: 13px;
  color: var(--muted);
  line-height: 1.5;
}
a {
  text-decoration: underline;
}
.cookie-actions {
  display: flex;
  gap: 8px;
}
.cookie-actions button {
  flex: 1;
  font-size: 12px;
  min-height: 40px;
  padding: 8px;
}
@media (max-width: 700px) {
  .cookie-consent {
    bottom: calc(76px + env(safe-area-inset-bottom));
    right: 12px;
    width: calc(100vw - 24px);
    padding: 14px;
  }
}
</style>
