<script setup lang="ts">
interface Entry {
  id: string;
  name: string;
  searchQuery: string;
  revision: number;
  shared: boolean;
  usageCount: number;
  queries: string[];
  recipes: Array<{ slug: string; title: string }>;
}
const entries = ref<Entry[]>([]),
  pending = ref(true),
  saving = ref(false),
  status = ref(0),
  query = ref("");
const target = ref<Entry>(),
  searchQuery = ref(""),
  confirming = ref(false);
const toast = useToast();
const filtered = computed(() =>
  entries.value.filter((i) =>
    `${i.name} ${i.searchQuery} ${i.queries.join(" ")}`
      .toLocaleLowerCase("ru")
      .includes(query.value.trim().toLocaleLowerCase("ru")),
  ),
);
async function load() {
  pending.value = true;
  try {
    const data = await $fetch<{ items: Entry[] }>("/api/admin/ingredients", {
      retry: 0,
    });
    entries.value = data.items;
    status.value = 200;
  } catch (e: any) {
    status.value = e.statusCode || e.status;
    toast.show(
      status.value === 401
        ? "Войдите в служебный аккаунт."
        : status.value === 403
          ? "Нет доступа к справочнику ингредиентов."
          : "Не удалось загрузить ингредиенты.",
      "error",
    );
  } finally {
    pending.value = false;
  }
}
function edit(entry: Entry) {
  target.value = entry;
  searchQuery.value = entry.searchQuery;
  confirming.value = false;
}
async function save() {
  if (!target.value || saving.value) return;
  saving.value = true;
  try {
    const result = await $fetch<{ revision: number; affectedRecipes: number }>(
      `/api/admin/ingredients/${target.value.id}`,
      {
        method: "PUT",
        body: {
          searchQuery: searchQuery.value.trim(),
          revision: target.value.revision,
        },
        retry: 0,
      },
    );
    target.value = undefined;
    confirming.value = false;
    await load();
    toast.show(
      `Поисковое название обновлено в ${result.affectedRecipes} рецептах. Каталог обновится в течение минуты.`,
      "success",
    );
  } catch (e: any) {
    toast.show(
      e.statusCode === 409
        ? "Ингредиент изменён в другой вкладке. Обновите список и повторите."
        : "Не удалось сохранить поисковое название.",
      "error",
    );
  } finally {
    saving.value = false;
  }
}
onMounted(load);
useHead({
  title: "Ингредиенты рецептов · Nabo",
  meta: [{ name: "robots", content: "noindex,nofollow" }],
});
</script>
<template>
  <div class="inner-page ingredient-admin">
    <NuxtLink class="back-link" to="/admin/recipes"
      ><AppIcon name="ArrowLeft" :size="16" />Редактор рецептов</NuxtLink
    >
    <div class="page-heading">
      <div>
        <h1>Ингредиенты</h1>
        <p class="muted">
          Общее поисковое название для всех рецептов с этим ингредиентом.
        </p>
      </div>
      <button class="secondary" :disabled="saving || pending" @click="load">
        Обновить список
      </button>
    </div>
    <p v-if="pending" role="status">
      <span class="spinner" />Загружаем ингредиенты…
    </p>
    <NuxtLink v-else-if="status === 401" class="primary" to="/account"
      >Войти</NuxtLink
    >
    <template v-else-if="status === 200">
      <label class="ingredient-search"
        >Найти ингредиент<input
          v-model="query"
          type="search"
          placeholder="Например, яйца или молоко"
      /></label>
      <p class="muted">
        Найдено: {{ filtered.length }} из {{ entries.length }}
      </p>
      <div v-for="entry in filtered" :key="entry.id" class="ingredient-row">
        <div>
          <strong>{{ entry.name }}</strong
          ><small
            >{{ entry.usageCount }} рецептов<template
              v-if="entry.queries.length > 1"
            >
              · разные запросы в рецептах</template
            ></small
          >
        </div>
        <div class="ingredient-query">
          <span class="muted">Поиск в магазинах</span>
          <p>{{ entry.searchQuery }}</p>
        </div>
        <button
          class="secondary"
          :aria-label="`Изменить поисковое название «${entry.name}»`"
          @click="edit(entry)"
        >
          Изменить
        </button>
      </div>
      <p v-if="!filtered.length" class="muted">Ингредиенты не найдены.</p>
    </template>
    <AppModal
      v-if="target"
      :title="target.name"
      @close="!saving && (target = undefined)"
    >
      <form
        id="ingredient-edit"
        class="ingredient-form"
        @submit.prevent="confirming = true"
      >
        <label
          >Поисковое название<input
            v-model="searchQuery"
            required
            maxlength="160"
            :disabled="saving || confirming"
        /></label>
        <p class="muted">
          После сохранения это название используется во всех
          {{ target.usageCount }} рецептах. Количества, название для читателя и
          шаги приготовления не меняются.
        </p>
        <details v-if="target.queries.length > 1">
          <summary>Текущие запросы в рецептах</summary>
          <ul>
            <li v-for="variant in target.queries" :key="variant">
              {{ variant }}
            </li>
          </ul>
        </details>
        <details>
          <summary>Где используется · {{ target.usageCount }}</summary>
          <ul>
            <li v-for="recipe in target.recipes" :key="recipe.slug">
              <NuxtLink :to="`/admin/recipes?recipe=${recipe.slug}`">{{
                recipe.title
              }}</NuxtLink>
            </li>
          </ul>
        </details>
        <p v-if="confirming" class="ingredient-confirm">
          Заменить поисковое название на «{{ searchQuery.trim() }}» во всех
          связанных рецептах?
        </p>
      </form>
      <template #footer
        ><div class="ingredient-actions">
          <button
            class="secondary"
            :disabled="saving"
            @click="confirming ? (confirming = false) : (target = undefined)"
          >
            {{ confirming ? "Назад" : "Отмена" }}</button
          ><button
            v-if="!confirming"
            class="primary"
            type="submit"
            form="ingredient-edit"
            :disabled="
              !searchQuery.trim() ||
              (target.shared && searchQuery.trim() === target.searchQuery)
            "
          >
            Сохранить для всех рецептов</button
          ><button v-else class="primary" :disabled="saving" @click="save">
            <span v-if="saving" class="spinner" />{{
              saving ? "Сохраняем…" : "Подтвердить изменение"
            }}
          </button>
        </div></template
      >
    </AppModal>
  </div>
</template>
<style scoped>
.ingredient-search {
  display: grid;
  gap: 8px;
  max-width: 520px;
  margin-bottom: 16px;
}
.ingredient-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid var(--line);
}
.ingredient-row strong,
.ingredient-row small {
  display: block;
  overflow-wrap: anywhere;
}
.ingredient-row small {
  color: var(--muted);
  font-size: 12px;
  margin-top: 4px;
}
.ingredient-query {
  min-width: 0;
  overflow-wrap: anywhere;
}
.ingredient-query span {
  font-size: 11px;
}
.ingredient-query p {
  margin: 3px 0;
  font-size: 14px;
}
.ingredient-form {
  display: grid;
  gap: 16px;
}
.ingredient-form label {
  display: grid;
  gap: 8px;
}
.ingredient-form p {
  font-size: 13px;
  margin: 0;
}
.ingredient-form li {
  margin: 8px 0;
  overflow-wrap: anywhere;
}
.ingredient-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.ingredient-confirm {
  font-weight: 600;
}
.ingredient-form summary {
  cursor: pointer;
}
@media (max-width: 600px) {
  .ingredient-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
  }
  .ingredient-query {
    grid-column: 1;
    grid-row: 2;
  }
  .ingredient-row button {
    grid-column: 2;
    grid-row: 1/3;
    padding: 10px 14px;
  }
  .ingredient-actions .primary {
    flex: 1;
  }
}
</style>
