<script setup lang="ts">
import { retailStores } from "~/shared/yandex";
interface Diagnostic {
  keyConfigured: boolean;
  connection: string;
  products: number | null;
}
const diagnostic = ref<Diagnostic>(),
  pending = ref(false),
  importing = ref(false),
  accessStatus = ref(0);
const storeId = ref(retailStores[0].id as string),
  queries = ref("Молоко\nЯйца куриные\nСметана");
interface ImportResult {
  saved: number;
  queries: number;
  failedQueries: string[];
}
const result = ref<{
  saved: number;
  queries: number;
  failedQueries: string[];
}>();
const { location } = useRetail();
const toast = useToast();
const descriptions: Record<string, string> = {
  ready: "Ключ принят, наполнение индекса доступно.",
  missing_key: "На Vercel не задан NUXT_SEO_INGEST_KEY.",
  rejected_key:
    "Ключ не принят. Проверьте совпадение значений на Vercel и Railway и перезапустите оба сервиса.",
  unavailable:
    "SEO API недоступен. Проверьте сервис рецептов и его адрес в NUXT_RECIPES_API_BASE.",
};
async function check() {
  pending.value = true;
  try {
    diagnostic.value = await $fetch<Diagnostic>(
      "/api/admin/seo-products/check",
      { method: "POST", retry: 0 },
    );
    accessStatus.value = 200;
  } catch (e: any) {
    accessStatus.value = e.statusCode || e.status || 503;
    toast.show(
      accessStatus.value === 401
        ? "Войдите в служебный аккаунт."
        : accessStatus.value === 403
          ? "Нет доступа к SEO-индексу."
          : "Не удалось проверить SEO API.",
      "error",
    );
  } finally {
    pending.value = false;
  }
}
async function populate() {
  const lines = [
    ...new Set(
      queries.value
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  if (!lines.length || lines.length > 5 || lines.some((s) => s.length > 120)) {
    toast.show(
      "Укажите от 1 до 5 запросов до 120 символов, каждый с новой строки.",
      "error",
    );
    return;
  }
  importing.value = true;
  result.value = undefined;
  try {
    result.value = await $fetch<ImportResult>(
      "/api/admin/seo-products/import",
      {
        method: "POST",
        body: {
          storeId: storeId.value,
          queries: lines,
          location: location.value,
        },
        retry: 0,
        timeout: 120000,
      },
    );
    toast.show(
      result.value!.saved
        ? `Обработано товаров: ${result.value!.saved}`
        : "По этим запросам товары для индекса не найдены.",
      result.value!.saved ? "success" : "info",
    );
    await check();
  } catch (e: any) {
    toast.show(
      e.data?.message ||
        "Не удалось наполнить индекс. Проверьте подключение и повторите.",
      "error",
    );
  } finally {
    importing.value = false;
  }
}
onMounted(check);
</script>
<template>
  <div class="inner-page seo-admin">
    <NuxtLink to="/admin/recipes" class="back-link"
      ><AppIcon name="ArrowLeft" :size="16" />К рецептам</NuxtLink
    >
    <h1>SEO товаров</h1>
    <p class="muted">
      Реальные товары из поиска сохраняются в общий индекс. Он используется в
      каталогах и sitemap.
    </p>
    <p v-if="pending && !diagnostic" role="status">
      <span class="spinner" />Проверяем подключение…
    </p>
    <NuxtLink
      v-if="accessStatus === 401"
      class="primary"
      :to="{ path: '/account', query: { returnTo: '/admin/seo-products' } }"
      >Войти в служебный аккаунт</NuxtLink
    >
    <p v-else-if="accessStatus === 403" class="info-note">
      Страница доступна только редактору.
    </p>
    <template v-if="accessStatus === 200 && diagnostic">
      <section class="panel">
        <div class="seo-status">
          <div>
            <h2>Подключение</h2>
            <p>{{ descriptions[diagnostic.connection] }}</p>
          </div>
          <button
            class="secondary"
            :disabled="pending || importing"
            @click="check"
          >
            <span v-if="pending" class="spinner" />Проверить
          </button>
        </div>
        <p>
          <strong>{{
            diagnostic.products === null ? "Нет данных" : diagnostic.products
          }}</strong>
          товаров в актуальном индексе
        </p>
        <p class="muted">
          После записи количество и sitemap обновляются в течение нескольких
          минут из-за кэша. Повторные товары обновляются, без дублей.
        </p>
        <a href="/sitemap.xml" target="_blank" rel="noopener"
          >Открыть sitemap</a
        >
      </section>
      <section v-if="diagnostic.connection !== 'ready'" class="panel">
        <h2>Настройка</h2>
        <ol>
          <li>
            Создайте случайный секрет командой
            <code>openssl rand -hex 32</code>.
          </li>
          <li>
            В Railway сервиса <strong>nabo-recipes</strong> добавьте
            <code>SEO_INGEST_KEY</code>.
          </li>
          <li>
            На Vercel для Production добавьте тот же секрет в
            <code>NUXT_SEO_INGEST_KEY</code>.
          </li>
          <li>
            Перезапустите Railway, сделайте redeploy Vercel и нажмите
            «Проверить».
          </li>
        </ol>
        <p class="muted">
          Ключи приватные: их не нужно вставлять в эту форму, Git или переписку.
        </p>
      </section>
      <form class="panel seo-import" @submit.prevent="populate">
        <h2>Начальное наполнение</h2>
        <p class="muted">
          До 20 товаров по каждому запросу. Ничего не добавляется в корзину.
          Затем индекс будет пополняться из обычного поиска пользователей.
        </p>
        <label
          >Магазин<select v-model="storeId" :disabled="importing">
            <option
              v-for="store in retailStores"
              :key="store.id"
              :value="store.id"
            >
              {{ store.name }}
            </option>
          </select></label
        >
        <label
          >Точные запросы, каждый с новой строки<textarea
            v-model="queries"
            rows="5"
            maxlength="604"
            :disabled="importing"
            required
          />
        </label>
        <p class="muted">
          Поиск рядом с «{{ location.label }}». Изменить точку можно в шапке
          сайта. Координаты в индекс не сохраняются.
        </p>
        <button
          class="primary"
          :disabled="importing || pending || diagnostic.connection !== 'ready'"
        >
          <span v-if="importing" class="spinner" />{{
            importing ? "Ищем и сохраняем…" : "Найти и добавить в индекс"
          }}
        </button>
        <p v-if="result" role="status">
          Обработано: {{ result.saved }} товаров.{{
            result.failedQueries.length
              ? ` Не ответили запросы: ${result.failedQueries.join(", ")}.`
              : ""
          }}
        </p>
      </form>
    </template>
    <button
      v-else-if="!pending && accessStatus >= 500"
      class="secondary"
      @click="check"
    >
      Повторить проверку
    </button>
  </div>
</template>
<style scoped>
.seo-admin {
  max-width: 920px;
}
.seo-admin h1 {
  margin-bottom: 12px;
}
.seo-admin > p {
  margin-bottom: 24px;
}
.seo-admin .panel {
  padding: 24px;
  margin: 20px 0;
}
.seo-admin h2 {
  font-size: 20px;
  margin-bottom: 12px;
}
.seo-status {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 16px;
}
.seo-status > div {
  min-width: 0;
}
.seo-admin code {
  overflow-wrap: anywhere;
  font-size: 13px;
}
.seo-admin li {
  margin-bottom: 12px;
}
.seo-import {
  display: grid;
  gap: 16px;
}
.seo-import label {
  display: grid;
  gap: 8px;
}
.seo-import textarea {
  width: 100%;
  resize: vertical;
}
.seo-import button {
  justify-self: start;
}
@media (max-width: 600px) {
  .seo-admin .panel {
    padding: 16px;
  }
  .seo-status {
    flex-wrap: wrap;
  }
  .seo-import button {
    width: 100%;
  }
}
</style>
