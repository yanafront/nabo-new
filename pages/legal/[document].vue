<script setup lang="ts">
import { legalDocuments, legalVersion } from "~/shared/legal";
const route = useRoute();
const key = String(route.params.document) as keyof typeof legalDocuments;
const document = Object.hasOwn(legalDocuments, key) ? legalDocuments[key] : undefined;
if (!document)
  throw createError({ statusCode: 404, statusMessage: "Документ не найден" });
const legal = useRuntimeConfig().public.legal;
const ready = computed(() =>
  Boolean(legal.operator && legal.address && legal.email),
);
const cookieSettings = useState("cookie-settings-open", () => false);
useHead({ title: `${document.title} — Nabo` });
</script>
<template>
  <article class="legal-document">
    <NuxtLink to="/" class="text-button">На главную</NuxtLink>
    <h1>{{ document.title }}</h1>
    <p class="legal-version">Редакция от {{ legalVersion }}</p>
    <p v-if="!ready" class="legal-draft" role="status">
      Проект документа. Для утверждения нужны реквизиты оператора, сроки
      хранения и подтверждение условий обработки у поставщиков. Эта редакция
      пока не является завершённой политикой сервиса.
    </p>
    <section v-for="section in document.sections" :key="section.title">
      <h2>{{ section.title }}</h2>
      <p>{{ section.text }}</p>
    </section>
    <section>
      <h2>Оператор и обращения</h2>
      <template v-if="ready"
        ><p>
          {{ legal.operator
          }}<span v-if="legal.unp"> · УНП {{ legal.unp }}</span>
        </p>
        <p>{{ legal.address }}</p>
        <a :href="`mailto:${legal.email}`">{{ legal.email }}</a></template
      >
      <p v-else>
        Реквизиты оператора и контакт для заявлений ещё не предоставлены
        владельцем Nabo.
      </p>
    </section>
    <button
      v-if="key === 'cookies'"
      class="secondary"
      @click="cookieSettings = true"
    >
      Настройки cookies
    </button>
    <p class="legal-sources">
      Основания:
      <a
        href="https://pravo.by/document/?guid=3871&amp;p0=H12100099"
        target="_blank"
        rel="noopener"
        >Закон № 99-З</a
      >
      · <a href="https://cpd.by/" target="_blank" rel="noopener">НЦЗПД</a
      ><template v-if="key === 'cookies'">
        ·
        <a
          href="https://yandex.ru/support/metrica/general/cookie-usage.html"
          target="_blank"
          rel="noopener"
          >Cookies Метрики</a
        ></template
      >
    </p>
  </article>
</template>
<style scoped>
.legal-document {
  max-width: 800px;
  margin: 32px auto 56px;
}
h1 {
  font-size: clamp(26px, 4vw, 38px);
  line-height: 1.2;
  margin: 20px 0 8px;
}
h2 {
  font-size: 19px;
  margin: 28px 0 10px;
}
p {
  line-height: 1.75;
}
.legal-version,
.legal-sources {
  color: var(--muted);
  font-size: 13px;
}
a {
  text-decoration: underline;
  text-underline-offset: 3px;
}
.legal-draft {
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--brand-soft);
  padding: 16px;
  font-size: 14px;
}
</style>
